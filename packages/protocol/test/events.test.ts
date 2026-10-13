/**
 * 序号跟踪与事件消费的断言。
 *
 * 立场是**内核与界面两侧必须一致**：Rust 侧 `synra-ipc` 的同名类型有同一套语义，所以这里的每个断言
 * 在那边都有对应的一条。两侧分歧的表现是"界面偶尔少一行"或"偶发地重读快照"，而两种都不会报错。
 */

// Relative imports rather than the package name: `@synra/protocol` is a **type-only** package, so it has no
// runtime entry point by design and importing it by name would fail to resolve. A test is the one place a source
// import is right — it is testing the source, not the published package.
import { SequenceTracker, isDelta } from '../src/generated/events'
import type { KernelEvent, SequencedKernelEvent } from '../src/generated/events'
import { describe, expect, it } from 'vitest'

/** 一个最小的事件，用于只关心序号的用例。 */
function logLine(line = 'x'): KernelEvent {
  return { type: 'logLine', payload: { level: 'info', line } }
}

/** 一个带序号的日志事件。 */
function envelope(seq: number): SequencedKernelEvent {
  return { seq, at: 0, ...logLine() }
}

describe('the sequence tracker', () => {
  it('applies the first event rather than calling it a gap', () => {
    // 内核的计数器从一开始，所以中途启动的界面否则会立刻报间隙，去重读它刚取过的快照。
    const tracker = new SequenceTracker()
    expect(tracker.observe(1)).toEqual({ kind: 'apply' })
    expect(tracker.lastSeen).toBe(1)
    expect(tracker.gaps).toBe(0)
  })

  it('applies a contiguous event', () => {
    const tracker = new SequenceTracker()
    tracker.observe(7)
    expect(tracker.observe(8)).toEqual({ kind: 'apply' })
    expect(tracker.observe(9)).toEqual({ kind: 'apply' })
    expect(tracker.lastSeen).toBe(9)
  })

  it('asks for a snapshot on a gap and counts what was missed', () => {
    // 间隙无法从事件本身修复 —— 丢掉的已经没了 —— 所以唯一正确的反应是重读。
    const tracker = new SequenceTracker()
    tracker.observe(1)
    expect(tracker.observe(4)).toEqual({ kind: 'refreshSnapshot', missed: 2 })
    expect(tracker.gaps).toBe(1)
  })

  it('reports a huge gap without a count', () => {
    // 几千的跳变给出的是没人会读的数字。
    const tracker = new SequenceTracker()
    tracker.observe(1)
    expect(tracker.observe(Number.MAX_SAFE_INTEGER)).toEqual({ kind: 'refreshSnapshot' })
  })

  it('ignores a repeat', () => {
    // 通道会在重载前后把同一个事件投两次，而 `deviceCardUpdated` 应用两次就是一个设备出现在列表里
    // 一次却被取两次。
    const tracker = new SequenceTracker()
    tracker.observe(5)
    expect(tracker.observe(5)).toEqual({ kind: 'ignoreRepeat' })
    expect(tracker.observe(4)).toEqual({ kind: 'ignoreRepeat' })
  })

  it('does not advance the sequence on a repeat', () => {
    // 推进会让下一个连续事件看起来像间隙，而那是一次毫无来由的重读。
    const tracker = new SequenceTracker()
    tracker.observe(5)
    tracker.observe(5)
    expect(tracker.lastSeen).toBe(5)
    expect(tracker.observe(6)).toEqual({ kind: 'apply' })
  })

  it('counts a gap once rather than per event', () => {
    // 界面正要重读，所以把同一个间隙当成新的会让它在该间隙持续的每一帧都要一次快照。
    const tracker = new SequenceTracker()
    tracker.observe(1)
    tracker.observe(10)
    expect(tracker.gaps).toBe(1)
    expect(tracker.observe(11)).toEqual({ kind: 'apply' })
    expect(tracker.gaps).toBe(1)
  })

  it('marks the picture stale until a snapshot answers', () => {
    // ★ 这是界面唯一能分清"我漏了东西"与"我是最新的"的方式。仍然渲染的界面展示的是它自己知道不对的
    // 东西。
    const tracker = new SequenceTracker()
    tracker.observe(1)
    expect(tracker.isStale).toBe(false)

    tracker.observe(5)
    expect(tracker.isStale).toBe(true)

    tracker.snapshotTaken()
    expect(tracker.isStale).toBe(false)
  })

  it('resets for a reload', () => {
    // 序号不跨重载持久化：回来的界面会取快照，而记住的序号会让重载后的第一个事件看起来像间隙。
    const tracker = new SequenceTracker()
    tracker.observe(100)
    tracker.observe(200)
    tracker.reset()
    expect(tracker.lastSeen).toBeUndefined()
    expect(tracker.isStale).toBe(false)
    expect(tracker.observe(1)).toEqual({ kind: 'apply' })
  })

  it('reports what a diagnostic bundle needs', () => {
    const tracker = new SequenceTracker()
    tracker.observe(1)
    tracker.observe(3)
    expect(tracker.report()).toEqual({ last: 3, gaps: 1 })
    expect(new SequenceTracker().report()).toEqual({ gaps: 0 })
  })

  it('never goes backwards over a run of numbers', () => {
    // 属性：无论喂进什么顺序，已记录的序号从不下降。下降之后每个事件都会被当成重复，界面就不再更新了。
    const tracker = new SequenceTracker()
    const sequences = [5, 5, 3, 6, 6, 10, 9, 11, 2, 12]
    let previous = 0
    for (const seq of sequences) {
      tracker.observe(seq)
      const last = tracker.lastSeen ?? previous
      expect(last).toBeGreaterThanOrEqual(previous)
      previous = last
    }
  })
})

describe('the event envelope', () => {
  it('carries the sequence alongside the event', () => {
    // Rust 侧是 `#[serde(flatten)]`，所以线上是**一个**对象：`seq`、`at` 与 `type` 在同一层。
    const value = envelope(3)
    expect(value.seq).toBe(3)
    expect(value.type).toBe('logLine')
    expect('payload' in value).toBe(true)
  })

  it('keeps the tag reachable before the payload is parsed', () => {
    // 界面先读标签再解析载荷，所以一个不认识的类型是**已知的**未知，而不是语法错误 —— 这正是让
    // `default` 分支能分清"更新的内核"与"损坏的通道"的东西。
    const raw = JSON.parse('{"seq":1,"at":0,"type":"somethingNew","payload":{"x":1}}') as {
      readonly type: string
    }
    expect(raw.type).toBe('somethingNew')
  })

  it('is judged by its sequence, not its timestamp', () => {
    // 同一毫秒内发布两个事件是常事，而时钟会移动。排序靠序号。
    const tracker = new SequenceTracker()
    const first: SequencedKernelEvent = { seq: 1, at: 1_000, ...logLine('a') }
    const second: SequencedKernelEvent = { seq: 2, at: 999, ...logLine('b') }

    expect(tracker.observe(first.seq)).toEqual({ kind: 'apply' })
    expect(tracker.observe(second.seq)).toEqual({ kind: 'apply' })
  })
})

describe('deltas', () => {
  it('reports that no event carries one', () => {
    // 每个事件带的都是**绝对值**（进度是比例而非字节数），所以重复应用它不改变什么。这个函数存在，是
    // 为了将来某个携带增量的事件必须自己说出来。
    const events: readonly KernelEvent[] = [
      { type: 'deviceRemoved', payload: { deviceId: 'd' } },
      logLine(),
      {
        type: 'pluginInstallProgress',
        payload: { pluginId: '@a/b', progress: 0.5, stage: 'downloading' },
      },
    ]
    for (const event of events) {
      expect(isDelta(event)).toBe(false)
    }
  })

  it('carries progress as a fraction rather than a byte count', () => {
    // 比例才是让重复无害的东西：字节数会累加，比例不会。
    const event: KernelEvent = {
      type: 'pluginInstallProgress',
      payload: { pluginId: '@a/b', progress: 0.25, stage: 'downloading' },
    }
    expect(event.payload.progress).toBe(0.25)
  })
})

describe('an interface that predates the kernel still works', () => {
  it('turns an unknown event into a snapshot refresh rather than a crash', () => {
    // 设计文档的 `default` 分支，作为可执行的语句：内核加了变体，旧界面重读而不是崩溃。
    const tracker = new SequenceTracker()
    const known = envelope(1)
    expect(tracker.observe(known.seq)).toEqual({ kind: 'apply' })

    // 一个较新的内核发来的事件 —— 界面解析不了它的 `type` —— 但序号仍然被跟踪，所以界面知道它漏了
    // 什么并重读。
    const fromANewerKernel = 2
    expect(tracker.observe(fromANewerKernel)).toEqual({ kind: 'apply' })

    // 而一个跳变仍然被识别，即使中间的事件都是不认识的。
    expect(tracker.observe(5)).toEqual({ kind: 'refreshSnapshot', missed: 2 })
  })
})
