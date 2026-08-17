import {
  describeRow,
  groupFlowRows,
  nextElementNode,
  processCountParts,
  reconcileFoldState,
  toggleLayer,
  visibilityOf,
} from './fold-logic.mjs'
import { createTranslator } from './fold-i18n.mjs'
import { createPrefStore } from './fold-prefs.mjs'
import { SETTINGS_CSS, registerSettings } from './fold-settings.mjs'

export const PLUGIN_ATTR = 'data-dsh-folded-chat'
export const BAR_ATTR = 'data-dsh-folded-chat-bar'
export const HIDDEN_ATTR = 'data-dsh-folded-chat-hidden'
export const STYLE_ATTR = 'data-dsh-folded-chat-style'

export const CSS = [
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;margin:4px 0 2px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:var(--dsw-alias-label-secondary,#8b93a0);cursor:pointer;font-size:14px;line-height:1.4;user-select:none}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-bar:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-bar:active{background:var(--dsw-alias-interactive-bg-pressed,rgba(127,127,127,.2))}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-arrow{flex:none;display:inline-flex;width:1em;height:1em;color:var(--dsw-alias-label-secondary,#8b93a0);transition:transform .18s ease}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-arrow svg{display:block;width:1em;height:1em}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-bar[data-open="true"] .dsh-folded-chat-arrow{transform:rotate(90deg)}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-count{flex:none;margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#7c8594);background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.14));border-radius:999px;padding:1px 8px}`,
  `body[${PLUGIN_ATTR}] .dsh-folded-chat-bar[data-fold-layer="inner"]{margin-left:12px;padding:5px 10px}`,
  `@media (prefers-reduced-motion:reduce){body[${PLUGIN_ATTR}] .dsh-folded-chat-arrow{transition:none}}`,
  SETTINGS_CSS,
].join('\n')

function thinkNode(row) {
  return row == null || typeof row.querySelector !== 'function'
    ? null
    : row.querySelector('[data-variant="think"]')
}

function hideNode(el) {
  if (el == null || el.nodeType !== 1) return
  el.setAttribute(HIDDEN_ATTR, '')
  el.style.display = 'none'
}

function showNode(el) {
  if (el == null || el.nodeType !== 1) return
  if (el.getAttribute(HIDDEN_ATTR) == null && el.style.display !== 'none') return
  el.removeAttribute(HIDDEN_ATTR)
  el.style.display = ''
}

function findBar(root, key, layer) {
  const bars = root.querySelectorAll('[' + BAR_ATTR + ']')
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].getAttribute('data-fold-key') === key && bars[i].getAttribute('data-fold-layer') === layer) {
      return bars[i]
    }
  }
  return null
}

function placeBefore(bar, target) {
  const parent = target == null ? null : target.parentNode
  if (parent == null) return
  if (bar.parentNode === parent && nextElementNode(bar) === target) return
  parent.insertBefore(bar, target)
}

export function restoreHidden(doc) {
  const marked = doc.querySelectorAll('[' + HIDDEN_ATTR + ']')
  for (let i = 0; i < marked.length; i++) showNode(marked[i])
}

export function removeOwnedBars(doc) {
  const bars = doc.querySelectorAll('[' + BAR_ATTR + ']')
  for (let i = 0; i < bars.length; i++) bars[i].remove()
}

function fallbackPrefs() {
  return { enabled: true, collapseOuter: true, collapseInner: true }
}

export function createFoldController(doc, options) {
  const getPrefs = options != null && typeof options.getPrefs === 'function' ? options.getPrefs : fallbackPrefs
  const t = options != null && typeof options.t === 'function' ? options.t : function (key) { return key }
  const stateByRoot = new WeakMap()

  function stateMap(root) {
    let map = stateByRoot.get(root)
    if (map == null) {
      map = new Map()
      stateByRoot.set(root, map)
    }
    return map
  }

  function makeBar(key, layer, onToggle) {
    const bar = doc.createElement('div')
    bar.className = 'dsh-folded-chat-bar'
    bar.setAttribute(BAR_ATTR, '')
    bar.setAttribute('data-fold-key', key)
    bar.setAttribute('data-fold-layer', layer)
    bar.setAttribute('role', 'button')
    bar.setAttribute('tabindex', '0')
    const arrow = doc.createElement('span')
    arrow.className = 'dsh-folded-chat-arrow'
    arrow.setAttribute('aria-hidden', 'true')
    arrow.innerHTML = '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M6 3.2 11.8 8 6 12.8z"/></svg>'
    const label = doc.createElement('span')
    label.className = 'dsh-folded-chat-label'
    const count = doc.createElement('span')
    count.className = 'dsh-folded-chat-count'
    bar.appendChild(arrow)
    bar.appendChild(label)
    bar.appendChild(count)
    const toggle = function () { onToggle() }
    bar.addEventListener('click', toggle)
    bar.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggle()
      }
    })
    return bar
  }

  function paintBar(bar, layer, open, counts) {
    const thinkCount = counts && counts.thinkCount ? counts.thinkCount : 0
    const toolCount = counts && counts.toolCount ? counts.toolCount : 0
    bar.setAttribute('data-open', open ? 'true' : 'false')
    bar.setAttribute('aria-expanded', open ? 'true' : 'false')
    const label = bar.querySelector('.dsh-folded-chat-label')
    const count = bar.querySelector('.dsh-folded-chat-count')
    if (layer === 'outer') {
      label.textContent = open ? t('processOpen') : t('process')
      count.textContent = processCountParts(thinkCount, toolCount)
        .map(function (part) { return t(part.key, { count: part.count }) })
        .join(' · ')
    } else {
      label.textContent = open ? t('toolCallsOpen') : t('toolCalls')
      count.textContent = t('toolCount', { count: toolCount })
    }
  }

  function syncRoot(root) {
    const raw = root.querySelectorAll('[data-chat-flow-kind]')
    const rows = []
    for (let i = 0; i < raw.length; i++) {
      const described = describeRow(raw[i])
      if (described != null) rows.push(described)
    }
    const groups = groupFlowRows(rows)
    const map = stateMap(root)
    const live = new Set()

    for (const group of groups) {
      live.add(group.key)
      const next = reconcileFoldState(map.get(group.key), group.running, getPrefs(), group.settled === true)
      map.set(group.key, next)
      const vis = visibilityOf(next, group.toolCount)

      let outer = findBar(root, group.key, 'outer')
      if (outer == null) {
        outer = makeBar(group.key, 'outer', function () {
          map.set(group.key, toggleLayer(map.get(group.key), 'outer'))
          syncRoot(root)
        })
      }
      paintBar(outer, 'outer', next.outer === 'open', {
        thinkCount: group.thinkRows.length,
        toolCount: group.toolCount,
      })
      placeBefore(outer, group.startRow)

      for (let r = 0; r < group.thinkRows.length; r++) {
        const think = thinkNode(group.thinkRows[r])
        if (vis.thinkVisible) showNode(think)
        else hideNode(think)
      }
      for (let h = 0; h < group.hideRows.length; h++) {
        if (vis.thinkVisible) showNode(group.hideRows[h])
        else hideNode(group.hideRows[h])
      }

      if (vis.innerBar) {
        let inner = findBar(root, group.key, 'inner')
        if (inner == null) {
          inner = makeBar(group.key, 'inner', function () {
            map.set(group.key, toggleLayer(map.get(group.key), 'inner'))
            syncRoot(root)
          })
        }
        paintBar(inner, 'inner', next.inner === 'open', { toolCount: group.toolCount })
        placeBefore(inner, group.tools[0])
      } else {
        const inner = findBar(root, group.key, 'inner')
        if (inner != null) inner.remove()
      }

      for (let t = 0; t < group.tools.length; t++) {
        if (vis.toolsVisible) showNode(group.tools[t])
        else hideNode(group.tools[t])
      }
    }

    const bars = root.querySelectorAll('[' + BAR_ATTR + ']')
    for (let i = 0; i < bars.length; i++) {
      const key = bars[i].getAttribute('data-fold-key')
      if (key == null || live.has(key) === false) bars[i].remove()
    }
    for (const key of Array.from(map.keys())) {
      if (live.has(key) === false) map.delete(key)
    }
  }

  function clearState() {
    const columns = doc.querySelectorAll('[data-conversation-scroll]')
    for (let i = 0; i < columns.length; i++) stateByRoot.delete(columns[i])
  }

  function sync() {
    const prefs = getPrefs()
    if (prefs.enabled === false) {
      restoreHidden(doc)
      removeOwnedBars(doc)
      if (doc.body) doc.body.removeAttribute(PLUGIN_ATTR)
      return
    }
    if (doc.body) doc.body.setAttribute(PLUGIN_ATTR, '')
    const columns = doc.querySelectorAll('[data-conversation-scroll]')
    if (columns.length === 0) return
    for (let i = 0; i < columns.length; i++) syncRoot(columns[i])
  }

  function dispose() {
    restoreHidden(doc)
    removeOwnedBars(doc)
    if (doc.body) doc.body.removeAttribute(PLUGIN_ATTR)
    const style = doc.head == null ? null : doc.head.querySelector('[' + STYLE_ATTR + ']')
    if (style != null) style.remove()
  }

  return { sync, dispose, clearState }
}

function getReact() {
  try {
    if (typeof require === 'function') return require('react')
  } catch {
    return null
  }
  return null
}

export function apply(ctx) {
  const doc = document
  const store = createPrefStore(typeof localStorage === 'undefined' ? null : localStorage)
  const i18n = createTranslator(ctx)
  const controller = createFoldController(doc, {
    getPrefs: function () { return store.get() },
    t: i18n.t,
  })
  const style = doc.createElement('style')
  style.setAttribute(STYLE_ATTR, '')
  style.textContent = CSS
  if (doc.head) doc.head.appendChild(style)

  ctx.effect(function () {
    let scheduled = false
    function requestSync() {
      if (scheduled) return
      scheduled = true
      const run = function () {
        scheduled = false
        controller.sync()
      }
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
      else run()
    }
    const observer = new MutationObserver(requestSync)
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-chat-flow-kind', 'data-chat-anchor-key', 'data-streaming', 'data-variant', 'data-state'],
    })
    const timer = ctx.get('timer')
    const stopTimer = timer == null ? null : timer.interval(function () { controller.sync() }, 1000)
    const stopPrefs = store.subscribe(function () {
      controller.clearState()
      requestSync()
    })
    const stopLocale = i18n.subscribe(function () { requestSync() })
    const stopSettings = registerSettings(ctx, getReact(), store, i18n.t)
    requestSync()
    return function () {
      observer.disconnect()
      if (stopTimer != null) stopTimer()
      stopPrefs()
      stopLocale()
      if (typeof stopSettings === 'function') stopSettings()
      i18n.dispose()
      controller.dispose()
    }
  })
}
