// Helden-Übersicht: Filter-UI + Wiederverwendung der Site-Basis (Nav-Drawer, Live-Stats).
import './site.js'

const grid = document.querySelector('[data-heroes-grid]')
const countEl = document.querySelector('[data-filter-count]')
if (grid && countEl) {
  const cards = Array.from(grid.querySelectorAll('.hero-card'))
  const state = { difficulty: 'all', role: 'all' }

  const apply = () => {
    let visible = 0
    cards.forEach((card) => {
      const matchD = state.difficulty === 'all' || card.dataset.difficulty === state.difficulty
      const matchR = state.role === 'all' || card.dataset.role === state.role
      const show = matchD && matchR
      card.style.display = show ? '' : 'none'
      if (show) visible += 1
    })
    countEl.textContent = String(visible)
  }

  document.querySelectorAll('[data-filter-difficulty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.difficulty = btn.dataset.filterDifficulty
      document
        .querySelectorAll('[data-filter-difficulty]')
        .forEach((b) => b.classList.toggle('is-active', b === btn))
      apply()
    })
  })

  document.querySelectorAll('[data-filter-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.role = btn.dataset.filterRole
      document
        .querySelectorAll('[data-filter-role]')
        .forEach((b) => b.classList.toggle('is-active', b === btn))
      apply()
    })
  })
}
