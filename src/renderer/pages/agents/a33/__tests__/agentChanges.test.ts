import { describe, expect, it } from 'vitest'

import type { CherryMessagePart, CherryUIMessage } from '@shared/data/types/message'

import { collectChangedFiles } from '../agentChanges'

const claudeTool = (name: string, input: object, state = 'output-available') =>
  ({
    type: `tool-${name}`,
    toolCallId: `${name}-${Math.random()}`,
    state,
    input,
    output: 'ok',
    callProviderMetadata: { cherry: { transport: 'claude-agent' } }
  }) as unknown as CherryMessagePart

const piTool = (name: string, input: object) =>
  ({
    type: `tool-${name}`,
    toolCallId: `${name}-${Math.random()}`,
    state: 'output-available',
    input,
    output: 'ok',
    callProviderMetadata: { cherry: { transport: 'pi-agent' } }
  }) as unknown as CherryMessagePart

const conversation = (parts: CherryMessagePart[]) => {
  const message = { id: 'm1', role: 'assistant', parts: [] } as unknown as CherryUIMessage
  return [[message], { m1: parts }] as const
}

describe('collectChangedFiles', () => {
  it('sums Claude Code Write, Edit and MultiEdit calls per file', () => {
    const [messages, parts] = conversation([
      claudeTool('Write', { file_path: '/p/a.ts', content: 'one\ntwo\nthree' }),
      claudeTool('Edit', { file_path: '/p/a.ts', old_string: 'two', new_string: 'two\n2b' }),
      claudeTool('MultiEdit', {
        file_path: '/p/b.ts',
        edits: [
          { old_string: 'x\ny', new_string: 'z' },
          { old_string: 'q', new_string: 'r\ns' }
        ]
      })
    ])

    expect(collectChangedFiles(messages, parts)).toEqual([
      { path: '/p/a.ts', additions: 5, deletions: 1 },
      { path: '/p/b.ts', additions: 3, deletions: 3 }
    ])
  })

  it("understands Pi's edit / write tools and field names", () => {
    const [messages, parts] = conversation([
      piTool('write', { path: '/p/c.ts', content: 'a\nb' }),
      piTool('edit', { path: '/p/c.ts', oldText: 'a', newText: 'a1\na2' })
    ])

    expect(collectChangedFiles(messages, parts)).toEqual([{ path: '/p/c.ts', additions: 4, deletions: 1 }])
  })

  it('ignores reads, failed or denied edits, and edits still streaming', () => {
    const [messages, parts] = conversation([
      claudeTool('Read', { file_path: '/p/a.ts' }),
      claudeTool('Edit', { file_path: '/p/a.ts', old_string: 'a', new_string: 'b' }, 'output-error'),
      claudeTool('Write', { file_path: '/p/d.ts', content: 'x' }, 'output-denied'),
      claudeTool('Write', { file_path: '/p/e.ts', content: 'x' }, 'input-streaming')
    ])

    expect(collectChangedFiles(messages, parts)).toEqual([])
  })
})
