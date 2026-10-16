/**
 * 事件与信封的**形状**断言。
 *
 * ★ `SequenceTracker` 与 `isDelta` 的断言已经搬到它们实现的地方：
 * `synra-rust-app/src/ipc/sequence.test.ts`。原因见那个文件的头部：
 * 这个包是纯类型的，而一个写着实现的类不该从它的公开面出口 ——
 * 这里原来那些用到它们的用例，测的正是那个不该存在的出口。
 *
 * 留在这里的是与线上字节有关的部分：信封是**一个**对象、标签在解析载荷之前可达、
 * 进度是比例而非字节数。这些全是类型层面的事实，也正是这个包存在的理由。
 */

import type { KernelEvent, SequencedKernelEvent } from '../src/generated/events'

import { describe, expect, it } from 'vitest'

/** 一个最小的事件。 */
function logLine(line = 'x'): KernelEvent {
  return { type: 'logLine', payload: { level: 'info', line } }
}

/** 一个带序号的日志事件。 */
function envelope(seq: number): SequencedKernelEvent {
  return { seq, at: 0, ...logLine() }
}

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
})

describe('deltas', () => {
  it('carries progress as a fraction rather than a byte count', () => {
    // 比例才是让重复无害的东西：字节数会累加，比例不会。这条是**形状**上的保证，
    // 而"因此每个事件都是幂等的"那个推论由 `isDelta` 在应用的测试里守着。
    const event: KernelEvent = {
      type: 'pluginInstallProgress',
      payload: { pluginId: '@a/b', progress: 0.25, stage: 'downloading' },
    }
    expect(event.payload.progress).toBe(0.25)
  })
})
