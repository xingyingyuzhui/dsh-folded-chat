import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultFoldState,
  describeRow,
  groupFlowRows,
  hasVisibleNonThinkContent,
  nextElementNode,
  processCountParts,
  reconcileFoldState,
  toggleLayer,
  visibilityOf,
} from '../fold-logic.mjs'

test('nextElementNode skips non-element siblings', () => {
  const text = { nodeType: 3, nextSibling: null }
  const el = { nodeType: 1, nextSibling: null }
  text.nextSibling = el
  assert.equal(nextElementNode({ nextSibling: text }), el)
  assert.equal(nextElementNode({ nextSibling: null }), null)
})

test('describeRow requires an official think node and stable anchor', () => {
  const think = { getAttribute: (key) => key === 'data-state' ? 'running' : null }
  const row = {
    getAttribute: (key) => ({
      'data-chat-flow-kind': 'assistant-step',
      'data-chat-anchor-key': 'step:1:2',
    }[key] ?? null),
    querySelector: (sel) => sel === '[data-variant="think"]' ? think : null,
  }
  const described = describeRow(row)
  assert.equal(described.kind, 'assistant-step')
  assert.equal(described.anchor, 'step:1:2')
  assert.equal(described.hasThink, true)
  assert.equal(described.running, true)
})

test('hasVisibleNonThinkContent ignores think and empty wrappers', () => {
  const think = {
    nodeType: 1,
    tagName: 'DIV',
    getAttribute: (key) => (key === 'data-variant' ? 'think' : null),
    childNodes: [{ nodeType: 3, textContent: 'hidden reasoning' }],
  }
  const empty = {
    nodeType: 1,
    tagName: 'P',
    getAttribute: () => null,
    childNodes: [{ nodeType: 3, textContent: '   ' }],
  }
  const answer = {
    nodeType: 1,
    tagName: 'P',
    getAttribute: () => null,
    childNodes: [{ nodeType: 3, textContent: '可见正文' }],
  }
  const row = {
    nodeType: 1,
    tagName: 'DIV',
    getAttribute: () => null,
    childNodes: [think, empty],
  }
  assert.equal(hasVisibleNonThinkContent(row), false)
  row.childNodes.push(answer)
  assert.equal(hasVisibleNonThinkContent(row), true)
})

test('groupFlowRows keeps think-only steps and following tool rows', () => {
  const think = { el: 'a', kind: 'assistant-step', anchor: 's1', hasThink: true, running: false }
  const tool1 = { el: 't1', kind: 'tool-call', anchor: 'c1', hasThink: false, running: false }
  const tool2 = { el: 't2', kind: 'tool-call', anchor: 'c2', hasThink: false, running: true }
  const user = { el: 'u', kind: 'user-message', anchor: 'u1', hasThink: false, running: false }
  const thinkOnly = { el: 'b', kind: 'assistant-step', anchor: 's2', hasThink: true, running: false }
  const laterUser = { el: 'u2', kind: 'user-message', anchor: 'u2', hasThink: false, running: false }
  const orphanTool = { el: 't3', kind: 'tool-call', anchor: 'c3', hasThink: false, running: false }

  const groups = groupFlowRows([think, tool1, tool2, user, thinkOnly, laterUser, orphanTool])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].key, 's1')
  assert.deepEqual(groups[0].tools, ['t1', 't2'])
  assert.equal(groups[0].running, true)
  assert.deepEqual(groups[0].hideRows, ['a'])
  assert.equal(groups[1].key, 's2')
  assert.equal(groups[1].toolCount, 0)
  assert.equal(groups[1].running, false)
})

test('groupFlowRows merges think-only steps until visible output', () => {
  const s1 = { el: 's1', kind: 'assistant-step', anchor: 'a1', hasThink: true, hasVisibleOutput: false, running: false }
  const t1 = { el: 't1', kind: 'tool-call', anchor: 'c1', hasThink: false, running: false }
  const s2 = { el: 's2', kind: 'assistant-step', anchor: 'a2', hasThink: true, hasVisibleOutput: false, running: true }
  const t2 = { el: 't2', kind: 'tool-call', anchor: 'c2', hasThink: false, running: false }
  const s3 = { el: 's3', kind: 'assistant-step', anchor: 'a3', hasThink: true, hasVisibleOutput: true, running: false }
  const t3 = { el: 't3', kind: 'tool-call', anchor: 'c3', hasThink: false, running: false }
  const user = { el: 'u', kind: 'user-message', anchor: 'u1', hasThink: false, running: false }
  const s4 = { el: 's4', kind: 'assistant-step', anchor: 'a4', hasThink: true, hasVisibleOutput: true, running: false }

  const groups = groupFlowRows([s1, t1, s2, t2, s3, t3, user, s4])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].key, 'a1')
  assert.deepEqual(groups[0].thinkRows, ['s1', 's2', 's3'])
  assert.deepEqual(groups[0].hideRows, ['s1', 's2'])
  assert.deepEqual(groups[0].tools, ['t1', 't2', 't3'])
  assert.equal(groups[0].running, true)
  assert.equal(groups[1].key, 'a4')
  assert.deepEqual(groups[1].hideRows, [])
})

test('groupFlowRows skips assistant-step rows without a stable key', () => {
  const groups = groupFlowRows([
    { el: 'x', kind: 'assistant-step', anchor: null, hasThink: true, running: false },
  ])
  assert.deepEqual(groups, [])
})

test('settled groups default both layers collapsed; running groups stay open', () => {
  assert.deepEqual(defaultFoldState(false), { outer: 'collapsed', inner: 'collapsed', touched: false })
  assert.deepEqual(defaultFoldState(true), { outer: 'open', inner: 'open', touched: false })
  assert.deepEqual(defaultFoldState(false, { collapseOuter: false, collapseInner: true }), {
    outer: 'open', inner: 'collapsed', touched: false,
  })
})

test('untouched state follows running; touched state is sticky', () => {
  const auto = reconcileFoldState(defaultFoldState(true), false)
  assert.equal(auto.outer, 'collapsed')
  const touched = toggleLayer(defaultFoldState(true), 'outer')
  const kept = reconcileFoldState(touched, false)
  assert.equal(kept.outer, 'collapsed')
  assert.equal(kept.touched, true)
  assert.equal(kept.inner, 'open')
})

test('processCountParts lists thinks and tools', () => {
  assert.deepEqual(processCountParts(3, 10), [
    { key: 'thinks', count: 3 },
    { key: 'tools', count: 10 },
  ])
  assert.deepEqual(processCountParts(2, 0), [{ key: 'thinks', count: 2 }])
  assert.deepEqual(processCountParts(0, 0), [{ key: 'thinking', count: 0 }])
})

test('visibility implements two layers without hiding assistant text', () => {
  const collapsed = visibilityOf({ outer: 'collapsed', inner: 'collapsed' }, 3)
  assert.deepEqual(collapsed, { thinkVisible: false, toolsVisible: false, innerBar: false })
  const outerOnly = visibilityOf({ outer: 'open', inner: 'collapsed' }, 3)
  assert.deepEqual(outerOnly, { thinkVisible: true, toolsVisible: false, innerBar: true })
  const open = visibilityOf({ outer: 'open', inner: 'open' }, 3)
  assert.deepEqual(open, { thinkVisible: true, toolsVisible: true, innerBar: true })
  const thinkOnly = visibilityOf({ outer: 'open', inner: 'collapsed' }, 0)
  assert.equal(thinkOnly.innerBar, false)
})
