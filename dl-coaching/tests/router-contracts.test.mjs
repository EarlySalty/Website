import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  createMemoryRouter,
  matchRoutes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])

test('React Router 7 stellt alle vom Coaching verwendeten APIs bereit', () => {
  for (const component of [BrowserRouter, Link, Route, Routes]) {
    assert.ok(component)
  }
  for (const api of [useLocation, useNavigate, useParams, useSearchParams]) {
    assert.equal(typeof api, 'function')
  }
})

test('externe Netzpfad-Navigation wird vom Router abgelehnt', async () => {
  for (const target of ['\\\\evil.example/app', '//evil.example/app']) {
    const router = createMemoryRouter([{ path: '*', element: null }])

    try {
      await assert.rejects(router.navigate(target), /External navigation is not allowed/)
      assert.equal(router.state.location.pathname, '/')
    } finally {
      router.dispose()
    }
  }
})

test('ein einzelner Backslash wird als same-origin Pfad behandelt', async () => {
  const router = createMemoryRouter([{ path: '*', element: null }])

  try {
    await router.navigate('\\evil.example/app')
    assert.equal(router.state.location.pathname, '/evil.example/app')
  } finally {
    router.dispose()
  }
})

test('die produktiven Coaching-Routen matchen nach dem Major-Update weiter', () => {
  assert.deepEqual(routePaths, [
    '/',
    'anfrage',
    'coaches/:id',
    'dashboard',
    'overview',
    'coachees/:id',
    'me',
    'me/scrims',
    'scrims',
    'scrims/teams/:id',
    'scrims/signup',
    'scrims/lage',
  ])

  const routes = [
    {
      path: '/',
      children: [{ index: true }, ...routePaths.slice(1).map((path) => ({ path }))],
    },
  ]
  const cases = [
    ['/', undefined],
    ['/anfrage?coach=7', undefined],
    ['/coaches/42', '42'],
    ['/coachees/84', '84'],
    ['/me/scrims', undefined],
    ['/scrims/teams/team-1', 'team-1'],
    ['/scrims/signup', undefined],
    ['/scrims/lage', undefined],
  ]

  for (const [location, expectedId] of cases) {
    const matches = matchRoutes(routes, location)
    assert.ok(matches, `${location} matcht keine Route`)
    assert.equal(matches.at(-1).params.id, expectedId)
  }
})
