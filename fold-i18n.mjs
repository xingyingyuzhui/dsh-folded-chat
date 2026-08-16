export const LOCALE_NS = 'dsh-folded-chat'

export const COPY = {
  zh: {
    process: '过程',
    processOpen: '过程（点击收起）',
    tools: '工具 ×{count}',
    thinking: '思考',
    toolCalls: '工具调用',
    toolCallsOpen: '工具调用（点击收起）',
    toolCount: '×{count}',
    cardTitle: '过程折叠',
    cardSubtitle: '聊天主视图',
    enable: '启用',
    collapseProcess: '默认折叠过程',
    collapseTools: '默认折叠工具',
  },
  en: {
    process: 'Process',
    processOpen: 'Process (collapse)',
    tools: 'Tools ×{count}',
    thinking: 'Thinking',
    toolCalls: 'Tool calls',
    toolCallsOpen: 'Tool calls (collapse)',
    toolCount: '×{count}',
    cardTitle: 'Folded Chat',
    cardSubtitle: 'Chat view',
    enable: 'Enable',
    collapseProcess: 'Collapse process by default',
    collapseTools: 'Collapse tools by default',
  },
}

export function detectLang(localeTag) {
  const tag = String(localeTag || '').toLowerCase()
  return tag.indexOf('zh') === 0 ? 'zh' : 'en'
}

export function interpolate(template, params) {
  if (params == null) return template
  return String(template).replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ))
}

export function translate(lang, key, params) {
  const table = COPY[lang] || COPY.en
  return interpolate(table[key] || COPY.en[key] || key, params)
}

export function createTranslator(ctx) {
  const locale = ctx != null && typeof ctx.get === 'function' ? ctx.get('locale') : null
  if (locale != null && typeof locale.register === 'function' && typeof locale.bind === 'function') {
    const dispose = locale.register(LOCALE_NS, COPY)
    const bound = locale.bind(LOCALE_NS)
    return {
      t: function (key, params) { return bound(key, params) },
      subscribe: typeof locale.subscribe === 'function' ? function (fn) { return locale.subscribe(fn) } : function () { return function () {} },
      dispose: dispose,
    }
  }
  const readLang = function () {
    const doc = typeof document !== 'undefined' ? document : null
    const nav = typeof navigator !== 'undefined' ? navigator : null
    const tag = (doc && doc.documentElement && doc.documentElement.lang) || (nav && nav.language) || 'en'
    return detectLang(tag)
  }
  return {
    t: function (key, params) { return translate(readLang(), key, params) },
    subscribe: function () { return function () {} },
    dispose: function () {},
  }
}
