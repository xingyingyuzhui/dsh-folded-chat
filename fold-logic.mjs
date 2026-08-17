// Pure grouping / visibility policy for the chat fold overlay.
// No DOM. Client runtime and tests share this file.

export function nextElementNode(node) {
  let current = node == null ? null : node.nextSibling
  while (current != null && current.nodeType !== 1) current = current.nextSibling
  return current
}

export function hasVisibleNonThinkContent(el) {
  if (el == null) return false
  function visit(node) {
    if (node == null) return false
    if (node.nodeType === 3) return String(node.textContent || '').trim() !== ''
    if (node.nodeType !== 1) return false
    if (typeof node.getAttribute === 'function') {
      if (node.getAttribute('data-variant') === 'think') return false
      if (node.getAttribute('data-dsh-folded-chat-bar') != null) return false
      if (node.getAttribute('aria-hidden') === 'true') return false
    }
    const tag = String(node.tagName || '').toLowerCase()
    if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'iframe') return true
    const children = node.childNodes || []
    for (let i = 0; i < children.length; i++) {
      if (visit(children[i])) return true
    }
    return false
  }
  return visit(el)
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
    hasVisibleOutput: hasVisibleNonThinkContent(el),
    running: runningThink || runningSelf,
  }
}

function takeProcessPiece(rows, start) {
  const row = rows[start]
  if (row == null || row.kind !== 'assistant-step' || row.hasThink !== true || !row.anchor) return null
  const tools = []
  let running = row.running === true
  let j = start + 1
  while (j < rows.length && rows[j] != null && rows[j].kind === 'tool-call') {
    tools.push(rows[j])
    if (rows[j].running === true) running = true
    j += 1
  }
  return {
    end: j,
    step: row,
    tools,
    running,
    hasVisibleOutput: row.hasVisibleOutput === true,
  }
}

export function groupFlowRows(rows) {
  const groups = []
  let i = 0
  let open = null
  while (i < rows.length) {
    const piece = takeProcessPiece(rows, i)
    if (piece == null) {
      if (rows[i] != null && rows[i].kind !== 'tool-call') open = null
      i += 1
      continue
    }
    if (open != null) {
      open.thinkRows.push(piece.step.el)
      if (piece.hasVisibleOutput !== true) open.hideRows.push(piece.step.el)
      for (let t = 0; t < piece.tools.length; t++) open.tools.push(piece.tools[t].el)
      open.toolCount = open.tools.length
      if (piece.running) open.running = true
      if (piece.hasVisibleOutput) open = null
      i = piece.end
      continue
    }
    const group = {
      key: piece.step.anchor,
      startRow: piece.step.el,
      thinkRows: [piece.step.el],
      hideRows: piece.hasVisibleOutput ? [] : [piece.step.el],
      tools: piece.tools.map((item) => item.el),
      toolCount: piece.tools.length,
      running: piece.running,
    }
    groups.push(group)
    open = piece.hasVisibleOutput ? null : group
    i = piece.end
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
