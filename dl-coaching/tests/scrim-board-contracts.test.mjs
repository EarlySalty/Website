import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const boardSource = await readFile(
  new URL('../src/pages/ScrimBoardPage.tsx', import.meta.url),
  'utf8',
)

test('reserve suggestions use the temporary substitute endpoint', () => {
  assert.match(boardSource, /scrims\.confirmSubstitute\(teamId,/)
  assert.match(boardSource, /participant_id:\s*participantId/)
  assert.match(boardSource, /window:\s*assignmentWindow/)
  assert.match(boardSource, /lastPool === 'reserve'/)
})

test('player suggestions keep the permanent participant assignment and explicitly join the starting six', () => {
  assert.match(
    boardSource,
    /participantMutation\.mutate\(\{\s*participantId,\s*patch:\s*\{\s*team_id:\s*teamId,\s*status:\s*'assigned',\s*is_bench:\s*false\s*\}\s*\}\)/,
  )
})

test('player suggestions request only the missing starting slots', () => {
  assert.match(boardSource, /missingStarterSlots\s*=\s*Math\.max\(0,\s*6\s*-\s*currentStarterCount\)/)
  assert.match(boardSource, /requestedSize\s*=\s*Math\.max\(1,\s*missingStarterSlots\)/)
})

test('team bench and global substitute pool are presented as separate concepts', () => {
  assert.match(boardSource, /label="Team-Bank"/)
  assert.match(boardSource, /Teamübergreifende Einspringer stehen nicht hier/)
})
