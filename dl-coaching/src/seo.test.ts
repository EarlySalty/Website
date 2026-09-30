import { strict as assert } from 'node:assert'
import test from 'node:test'
import { COACHING_URL, COACHING_TITLE, coachingPageMetadata } from './seo.ts'

test('only the public overview receives its shared landing title and schema', () => {
  for (const path of ['/', '']) {
    const meta = coachingPageMetadata(path)
    assert.equal(meta.isPublicOverview, true)
    assert.equal(meta.title, COACHING_TITLE)
    assert.equal(meta.canonical, COACHING_URL)
    assert.match(meta.robots, /^index,/)
  }
})

test('public coach profiles remain indexable with their own canonical', () => {
  for (const path of ['/coaches/42', '/coaches/42/', '/coaches/123e4567-e89b-12d3-a456-426614174000']) {
    const meta = coachingPageMetadata(path)
    assert.equal(meta.isPublicOverview, false)
    assert.equal(meta.canonical, COACHING_URL + path.replace(/^\//, '').replace(/\/$/, ''))
    assert.match(meta.robots, /^index,/)
  }
})

test('personal and unknown routes never reuse the public overview metadata after navigation', () => {
  for (const path of ['/me', '/anfrage', '/dashboard', '/overview', '/coachees/42', '/scrims', '/scrims/teams/42', '/missing']) {
    const meta = coachingPageMetadata(path)
    assert.equal(meta.isPublicOverview, false)
    assert.equal(meta.robots, 'noindex, follow')
    assert.notEqual(meta.title, COACHING_TITLE)
    assert.equal(new URL(meta.canonical).origin, new URL(COACHING_URL).origin)
    assert.notEqual(meta.canonical, COACHING_URL)
  }
})
