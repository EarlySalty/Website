const defaultApiBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`

export const apiBase = (import.meta.env.VITE_API_BASE || defaultApiBase).replace(/\/$/, '')
