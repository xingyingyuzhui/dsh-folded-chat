import assert from 'node:assert/strict'
import test from 'node:test'
import { BAR_ATTR, HIDDEN_ATTR, PLUGIN_ATTR, createFoldController } from '../fold-runtime.mjs'

function createDoc() {
  const listeners = new Map()
  const nodes = []

  function attach(node, parent) {
    node.parentNode = parent
    if (parent == null) return
    parent.childNodes.push(node)
  }

  function el(tag, attrs, children) {
    const node = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      attrs: { ...(attrs || {}) },
      style: { display: '' },
      className: attrs && attrs.class ? attrs.class : '',
      parentNode: null,
      childNodes: [],
      get nextSibling() {
        if (this.parentNode == null) return null
        const list = this.parentNode.childNodes
        const index = list.indexOf(this)
        return index === -1 ? null : list[index + 1] ?? null
      },
      getAttribute(key) { return this.attrs[key] == null ? null : this.attrs[key] },
      setAttribute(key, value) { this.attrs[key] = String(value) },
      removeAttribute(key) { delete this.attrs[key] },
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] ?? null
      },
      querySelectorAll(sel) {
        const out = []
        const visit = (current) => {
          if (current.nodeType === 1 && match(current, sel)) out.push(current)
          for (const child of current.childNodes) visit(child)
        }
        for (const child of this.childNodes) visit(child)
        return out
      },
      appendChild(child) {
        if (child.parentNode) child.parentNode.childNodes = child.parentNode.childNodes.filter((item) => item !== child)
        attach(child, this)
        return child
      },
      insertBefore(child, ref) {
        if (child.parentNode) child.parentNode.childNodes = child.parentNode.childNodes.filter((item) => item !== child)
        child.parentNode = this
        if (ref == null) this.childNodes.push(child)
        else this.childNodes.splice(this.childNodes.indexOf(ref), 0, child)
        return child
      },
      remove() {
        if (this.parentNode == null) return
        this.parentNode.childNodes = this.parentNode.childNodes.filter((item) => item !== this)
        this.parentNode = null
      },
      addEventListener(type, fn) {
        const key = type
        if (!listeners.has(key)) listeners.set(key, [])
        listeners.get(key).push([this, fn])
      },
    }
    nodes.push(node)
    for (const child of children || []) node.appendChild(child)
    return node
  }

  function match(node, sel) {
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const body = sel.slice(1, -1)
      const eq = body.indexOf('=')
      if (eq === -1) return node.getAttribute(body) != null
      const key = body.slice(0, eq)
      const value = body.slice(eq + 1).replace(/^"|"$/g, '').replace(/^'|'$/g, '')
      return node.getAttribute(key) === value
    }
    if (sel.startsWith('.')) return node.className.split(/\s+/).includes(sel.slice(1))
    return false
  }

  const body = el('body', {})
  const head = el('head', {})
  const list = el('div', { 'data-conversation-scroll': '' })
  body.appendChild(list)
  const doc = {
    body,
    head,
    createElement: (tag) => el(tag, {}),
    querySelector(sel) {
      if (sel === '[' + PLUGIN_ATTR + ']') return body.getAttribute(PLUGIN_ATTR) == null ? null : body
      return body.querySelector(sel) || head.querySelector(sel)
    },
    querySelectorAll(sel) {
      return [...head.querySelectorAll(sel), ...body.querySelectorAll(sel)]
    },
    list,
    el,
    click(target, type) {
      for (const [node, fn] of listeners.get(type || 'click') || []) {
        if (node === target) fn({ key: 'Enter', preventDefault() {} })
      }
    },
  }
  return doc
}

function seat(doc, kind, key, extras) {
  const kids = []
  if (extras && extras.think) {
    const think = doc.el('div', { 'data-variant': 'think', 'data-state': extras.running ? 'running' : 'ok' })
    think.childNodes.push({ nodeType: 3, textContent: 'reasoning', childNodes: [] })
    kids.push(think)
  }
  if (extras && extras.text) {
    const p = doc.el('p', {})
    p.childNodes.push({ nodeType: 3, textContent: extras.text === true ? 'answer' : String(extras.text), childNodes: [] })
    kids.push(p)
  }
  const row = doc.el('div', { 'data-chat-flow-kind': kind, 'data-chat-anchor-key': key })
  for (const kid of kids) row.appendChild(kid)
  return row
}

test('sync hides settled think+tools and restore clears display', () => {
  const doc = createDoc()
  const think = seat(doc, 'assistant-step', 'step:1', { think: true, text: true })
  const tool = seat(doc, 'tool-call', 'call:1', {})
  const text = think.childNodes[1]
  doc.list.appendChild(think)
  doc.list.appendChild(tool)
  const ctrl = createFoldController(doc)
  ctrl.sync()
  assert.equal(think.querySelector('[data-variant="think"]').style.display, 'none')
  assert.equal(tool.style.display, 'none')
  assert.equal(text.style.display, '')
  assert.equal(doc.list.querySelectorAll('[' + BAR_ATTR + ']').length, 1)
  ctrl.dispose()
  assert.equal(think.querySelector('[data-variant="think"]').style.display, '')
  assert.equal(tool.style.display, '')
  assert.equal(tool.getAttribute(HIDDEN_ATTR), null)
  assert.equal(doc.list.querySelectorAll('[' + BAR_ATTR + ']').length, 0)
})

test('two-level: expanding outer keeps tools folded until inner opens', () => {
  const doc = createDoc()
  const think = seat(doc, 'assistant-step', 'step:2', { think: true, text: true })
  const tool = seat(doc, 'tool-call', 'call:2', {})
  doc.list.appendChild(think)
  doc.list.appendChild(tool)
  const ctrl = createFoldController(doc)
  ctrl.sync()
  const outer = doc.list.querySelector('[data-fold-layer="outer"]')
  doc.click(outer, 'click')
  assert.equal(think.querySelector('[data-variant="think"]').style.display, '')
  assert.equal(tool.style.display, 'none')
  const inner = doc.list.querySelector('[data-fold-layer="inner"]')
  assert.ok(inner)
  doc.click(inner, 'click')
  assert.equal(tool.style.display, '')
})

test('running groups stay expanded', () => {
  const doc = createDoc()
  const think = seat(doc, 'assistant-step', 'step:3', { think: true, running: true })
  const tool = seat(doc, 'tool-call', 'call:3', {})
  doc.list.appendChild(think)
  doc.list.appendChild(tool)
  const ctrl = createFoldController(doc)
  ctrl.sync()
  assert.equal(think.querySelector('[data-variant="think"]').style.display, '')
  assert.equal(tool.style.display, '')
})

test('master switch off restores official nodes and removes bars', () => {
  const doc = createDoc()
  const think = seat(doc, 'assistant-step', 'step:off', { think: true, text: true })
  const tool = seat(doc, 'tool-call', 'call:off', {})
  doc.list.appendChild(think)
  doc.list.appendChild(tool)
  let prefs = { enabled: true, collapseOuter: true, collapseInner: true }
  const ctrl = createFoldController(doc, { getPrefs: () => prefs })
  ctrl.sync()
  assert.equal(tool.style.display, 'none')
  prefs = { ...prefs, enabled: false }
  ctrl.sync()
  assert.equal(tool.style.display, '')
  assert.equal(doc.list.querySelectorAll('[' + BAR_ATTR + ']').length, 0)
})

test('merges think-only steps into one process and hides empty rows', () => {
  const doc = createDoc()
  const s1 = seat(doc, 'assistant-step', 'step:a', { think: true })
  const t1 = seat(doc, 'tool-call', 'call:a', {})
  const s2 = seat(doc, 'assistant-step', 'step:b', { think: true })
  const t2 = seat(doc, 'tool-call', 'call:b', {})
  const s3 = seat(doc, 'assistant-step', 'step:c', { think: true, text: true })
  doc.list.appendChild(s1)
  doc.list.appendChild(t1)
  doc.list.appendChild(s2)
  doc.list.appendChild(t2)
  doc.list.appendChild(s3)
  const ctrl = createFoldController(doc)
  ctrl.sync()
  const outers = doc.list.querySelectorAll('[data-fold-layer="outer"]')
  assert.equal(outers.length, 1)
  assert.equal(s1.style.display, 'none')
  assert.equal(s2.style.display, 'none')
  assert.equal(t1.style.display, 'none')
  assert.equal(t2.style.display, 'none')
  assert.equal(s3.style.display, '')
  assert.equal(s3.querySelector('[data-variant="think"]').style.display, 'none')
  ctrl.dispose()
  assert.equal(s1.style.display, '')
  assert.equal(s2.style.display, '')
})

test('ignores rows outside data-conversation-scroll', () => {
  const doc = createDoc()
  const stray = seat(doc, 'assistant-step', 'step:x', { think: true })
  const strayTool = seat(doc, 'tool-call', 'call:x', {})
  doc.body.appendChild(stray)
  doc.body.appendChild(strayTool)
  const ctrl = createFoldController(doc)
  ctrl.sync()
  assert.equal(stray.style.display, '')
  assert.equal(strayTool.style.display, '')
  assert.equal(doc.body.querySelectorAll('[' + BAR_ATTR + ']').length, 0)
})
