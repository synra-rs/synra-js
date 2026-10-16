/**
 * 标签与版本之间那一步的判定。
 *
 * # 为什么测的是纯函数
 *
 * `releaseTagProblems` 的输出被 `main` 直接翻译成退出码，所以这里每一条断言都对应一次"发不发布"。
 * 而它最容易错的地方不是比较，是**边界**：空标签该不该算问题、一个包都没有该不该算通过、
 * 私有包该不该参与。三件都不会抛错，只会让一次错的发布看起来是对的。
 */

import { describe, expect, it } from 'vitest'

import { releaseTagProblems } from './check-release-tag'

const workspace = [
  { name: '@synra/client', version: '0.1.0' },
  { name: '@synra/protocol', version: '0.1.0' },
  { name: 'synra', version: '0.1.0' },
]

describe('releaseTagProblems', () => {
  it('is empty when every package carries the tag version', () => {
    expect(releaseTagProblems('0.1.0', workspace)).toEqual([])
  })

  it('names every package that disagrees, not just the first', () => {
    const problems = releaseTagProblems('0.2.0', [
      { name: '@synra/client', version: '0.1.0' },
      { name: '@synra/protocol', version: '0.2.0' },
      { name: 'synra', version: '0.1.0' },
    ])

    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toContain('@synra/client@0.1.0')
    expect(problems.join('\n')).toContain('synra@0.1.0')
    expect(problems.join('\n')).not.toContain('@synra/protocol@0.2.0')
  })

  // ★ 最坏的结果不是报错而是通过：本机跑这个脚本时 `GITHUB_REF_NAME` 不存在，
  //   一个"没有标签所以跳过"的分支会让一次什么都没查的运行亮绿灯。
  it('treats a missing tag as a problem rather than a skip', () => {
    const problems = releaseTagProblems('', workspace)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('GITHUB_REF_NAME')
  })

  // 空的包列表和"每个都对上了"都会得到空的问题列表，所以它必须自己成为一条问题：
  // 读错了目录（改过结构、或者每个包都被标成私有）时，这一步会静默地什么都不查。
  it('treats an empty workspace as a problem', () => {
    expect(releaseTagProblems('0.1.0', [])).toHaveLength(1)
  })
})
