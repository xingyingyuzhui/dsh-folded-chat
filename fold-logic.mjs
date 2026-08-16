// Pure grouping / visibility policy for the chat fold overlay.
// No DOM. Client runtime and tests share this file.

export function nextElementNode(node) {
  let current = node == null ? null : node.nextSibling
  while (current != null && current.nodeType !== 1) current = current.nextSibling
  return current
}

export function describeRow(el) {
  if (el == null || typeof el.getAttribute !== 'function') return null
  const think = typeof el.querySelector === 'function'
    ? el.querySelector('[data-variant="think"]')
    : null
  const runningThink = think != null && think.getAttribute('data-state') === 'running'
  const runningSelf = el.getAttribute('data-streaming') != null
    || (typeof el.querySelector === 'function' && el.querySelector('[data-state="running"]') != null)
  return {
    el,
    kind: el.getAttribute('data-chat-flow-kind'),
    anchor: el.getAttribute('data-chat-anchor-key'),
    hasThink: think != null,
    running: runningThink || runningSelf,
  }
}

export function groupFlowRows(rows) {
  const groups = []
  let i = 0
  while (i < rows.length) {
    const row = rows[i]
    if (row != null && row.kind === 'assistant-step' && row.hasThink === true && row.anchor) {
      const tools = []
      let running = row.running === true
      let j = i + 1
      while (j < rows.length && rows[j] != null && rows[j].kind === 'tool-call') {
        tools.push(rows[j])
        if (rows[j].running === true) running = true
        j += 1
      }
      groups.push({
        key: row.anchor,
        thinkRow: row.el,
        tools: tools.map((item) => item.el),
        toolCount: tools.length,
        running,
      })
      i = j
      continue
    }
    i += 1
  }
  return groups
}

export function defaultFoldState(running, prefs) {
  if (running) return { outer: 'open', inner: 'open', touched: false }
  const collapseOuter = prefs == null || prefs.collapseOuter !== false
  const collapseInner = prefs == null || prefs.collapseInner !== false
  return {
    outer: collapseOuter ? 'collapsed' : 'open',
    inner: collapseInner ? 'collapsed' : 'open',
    touched: false,
  }
}

export function reconcileFoldState(existing, running, prefs) {
  if (existing == null) return defaultFoldState(running, prefs)
  if (existing.touched === true) return existing
  return defaultFoldState(running, prefs)
}

export function toggleLayer(state, layer) {
  const current = state == null ? defaultFoldState(false, null) : state
  const next = { outer: current.outer, inner: current.inner, touched: true }
  const key = layer === 'inner' ? 'inner' : 'outer'
  next[key] = current[key] === 'open' ? 'collapsed' : 'open'
  return next
}

export function visibilityOf(state, toolCount) {
  const outerOpen = state != null && state.outer === 'open'
  const innerOpen = state != null && state.inner === 'open'
  return {
    thinkVisible: outerOpen,
    toolsVisible: outerOpen && innerOpen,
    innerBar: outerOpen && toolCount > 0,
  }
}
