import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceFromUrl } from '../src/source-from-url.mjs'

test('sourceFromUrl classifies only the URL hostname', () => {
  assert.equal(sourceFromUrl('https://store.steampowered.com/news/app/1422450'), 'steam')
  assert.equal(sourceFromUrl('https://forums.playdeadlock.com/threads/patch-notes.1'), 'forum')
  assert.equal(sourceFromUrl('https://evil.com/?x=store.steampowered.com'), 'other')
})
