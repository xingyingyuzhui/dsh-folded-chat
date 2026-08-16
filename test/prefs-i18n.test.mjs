import assert from 'node:assert/strict'
import test from 'node:test'
import { detectLang, translate } from '../fold-i18n.mjs'
import { loadPrefs, normalizePrefs, savePrefs } from '../fold-prefs.mjs'

test('detectLang treats zh* as Chinese and everything else as English', () => {
  assert.equal(detectLang('zh'), 'zh')
  assert.equal(detectLang('zh-CN'), 'zh')
  assert.equal(detectLang('en'), 'en')
  assert.equal(detectLang('en-US'), 'en')
  assert.equal(detectLang(''), 'en')
})

test('translate interpolates both locales', () => {
  assert.equal(translate('zh', 'process'), '过程')
  assert.equal(translate('en', 'process'), 'Process')
  assert.equal(translate('en', 'tools', { count: 3 }), 'Tools ×3')
  assert.equal(translate('zh', 'tools', { count: 3 }), '工具 ×3')
})

test('prefs default to enabled with both layers collapsed', () => {
  assert.deepEqual(normalizePrefs(null), {
    enabled: true,
    collapseOuter: true,
    collapseInner: true,
  })
  assert.equal(normalizePrefs({ enabled: false }).enabled, false)
  assert.equal(normalizePrefs({ collapseOuter: false }).collapseOuter, false)
})

test('prefs persist through a storage mock', () => {
  const mem = new Map()
  const storage = {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => { mem.set(key, value) },
  }
  savePrefs(storage, { enabled: false, collapseInner: false })
  assert.deepEqual(loadPrefs(storage), {
    enabled: false,
    collapseOuter: true,
    collapseInner: false,
  })
})
