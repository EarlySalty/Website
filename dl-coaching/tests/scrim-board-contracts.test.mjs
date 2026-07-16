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

test('player suggestions keep the permanent participant assignment', () => {
  assert.match(
    boardSource,
    /participantMutation\.mutate\(\{\s*participantId,\s*patch:\s*\{\s*team_id:\s*teamId,\s*status:\s*'assigned'\s*\}\s*\}\)/,
  )
})
