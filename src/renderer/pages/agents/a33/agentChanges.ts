import { getCanonicalToolName } from '@renderer/components/chat/messages/tools/toolResponse'
import type { CherryMessagePart, CherryUIMessage } from '@shared/data/types/message'

export interface ChangedFile {
  path: string
  additions: number
  deletions: number
}

type Input = Record<string, unknown>

const lines = (text: unknown): number => (typeof text === 'string' && text.length > 0 ? text.split('\n').length : 0)
const str = (input: Input, ...keys: string[]): unknown => keys.map((key) => input[key]).find((v) => v !== undefined)

/** One old→new replacement, in either runtime's field names (Claude Code `old_string`, Pi `oldText`). */
function replacementDelta(edit: Input): [number, number] {
  return [lines(str(edit, 'new_string', 'newText')), lines(str(edit, 'old_string', 'oldText'))]
}

function deltaFor(tool: string, input: Input): [number, number] | undefined {
  if (tool === 'Write') return [lines(str(input, 'content')), 0]
  if (tool !== 'Edit' && tool !== 'MultiEdit') return undefined
  const edits = Array.isArray(input.edits) ? (input.edits as Input[]) : [input]
  return edits.reduce<[number, number]>(
    ([added, removed], edit) => {
      const [a, r] = replacementDelta(edit)
      return [added + a, removed + r]
    },
    [0, 0]
  )
}

/**
 * Files the agent changed in a conversation, from its successful Edit / MultiEdit / Write tool calls
 * (Claude Code and Pi alike), with approximate added / removed line counts per file.
 */
export function collectChangedFiles(
  messages: readonly CherryUIMessage[],
  partsByMessageId: Record<string, CherryMessagePart[]>
): ChangedFile[] {
  const byPath = new Map<string, ChangedFile>()
  for (const message of messages) {
    for (const part of partsByMessageId[message.id] ?? message.parts ?? []) {
      const tool = getCanonicalToolName(part)
      if (!tool) continue
      const { state, input } = part as unknown as { state?: string; input?: unknown }
      if (state !== 'output-available' || typeof input !== 'object' || input === null) continue
      const delta = deltaFor(tool, input as Input)
      const path = str(input as Input, 'file_path', 'path')
      if (!delta || typeof path !== 'string' || !path) continue
      const entry = byPath.get(path) ?? { path, additions: 0, deletions: 0 }
      entry.additions += delta[0]
      entry.deletions += delta[1]
      byPath.set(path, entry)
    }
  }
  return [...byPath.values()]
}
