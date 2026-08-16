export const PREFS_KEY = 'dsh-folded-chat:prefs'

export function normalizePrefs(raw) {
  const value = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: value.enabled !== false,
    collapseOuter: value.collapseOuter !== false,
    collapseInner: value.collapseInner !== false,
  }
}

export function loadPrefs(storage) {
  if (storage == null || typeof storage.getItem !== 'function') return normalizePrefs(null)
  try {
    const text = storage.getItem(PREFS_KEY)
    if (text == null || text === '') return normalizePrefs(null)
    return normalizePrefs(JSON.parse(text))
  } catch {
    return normalizePrefs(null)
  }
}

export function savePrefs(storage, prefs) {
  const next = normalizePrefs(prefs)
  if (storage != null && typeof storage.setItem === 'function') {
    storage.setItem(PREFS_KEY, JSON.stringify(next))
  }
  return next
}

export function createPrefStore(storage) {
  let current = loadPrefs(storage)
  const listeners = new Set()
  return {
    get: function () { return current },
    set: function (patch) {
      current = savePrefs(storage, { ...current, ...patch })
      for (const listener of listeners) listener(current)
      return current
    },
    subscribe: function (listener) {
      listeners.add(listener)
      return function () { listeners.delete(listener) }
    },
  }
}
