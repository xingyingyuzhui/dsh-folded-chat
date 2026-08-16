export const SETTINGS_CSS = [
  '.dsh-folded-chat-card{list-style:none;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:12px;background:var(--dsw-alias-bg-layer-3,transparent)}',
  '.dsh-folded-chat-card[data-open="true"]{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}',
  '.dsh-folded-chat-card-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}',
  '.dsh-folded-chat-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#3b82f6);outline-offset:-2px}',
  '.dsh-folded-chat-card-head{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
  '.dsh-folded-chat-card-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,inherit)}',
  '.dsh-folded-chat-card-sub{font-size:13px;line-height:1.4;color:var(--dsw-alias-label-tertiary,#8b93a0)}',
  '.dsh-folded-chat-card-chevron{flex:none;width:1em;height:1em;color:var(--dsw-alias-label-tertiary,#8b93a0);transition:transform .16s}',
  '.dsh-folded-chat-card[data-open="true"] .dsh-folded-chat-card-chevron{transform:rotate(180deg)}',
  '.dsh-folded-chat-card-body{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));margin:0 16px;padding:4px 0 12px}',
  '.dsh-folded-chat-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0}',
  '.dsh-folded-chat-row + .dsh-folded-chat-row{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18))}',
  '.dsh-folded-chat-row-label{font-size:14px;line-height:1.4;color:var(--dsw-alias-label-primary,inherit)}',
  '.dsh-folded-chat-switch{appearance:none;width:36px;height:20px;flex:none;margin:0;border:0;border-radius:999px;background:var(--dsw-alias-border-l2,rgba(127,127,127,.35));cursor:pointer;position:relative}',
  '.dsh-folded-chat-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-layer-3,#fff);transition:transform .16s}',
  '.dsh-folded-chat-switch:checked{background:var(--dsw-alias-brand-primary,#3b82f6)}',
  '.dsh-folded-chat-switch:checked::after{transform:translateX(16px)}',
  '.dsh-folded-chat-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#3b82f6);outline-offset:2px}',
  '@media (prefers-reduced-motion:reduce){.dsh-folded-chat-card-chevron,.dsh-folded-chat-switch::after{transition:none}}',
].join('\n')

export function createSettingsCard(React, store, t) {
  return function FoldSettingsCard() {
    const useState = React.useState
    const [open, setOpen] = useState(false)
    const [prefs, setPrefs] = useState(function () { return store.get() })

    function toggle(key) {
      return function (event) {
        setPrefs(store.set({ [key]: event.target.checked }))
      }
    }

    function row(id, label, checked, onChange) {
      return React.createElement('div', { className: 'dsh-folded-chat-row' },
        React.createElement('label', { className: 'dsh-folded-chat-row-label', htmlFor: id }, label),
        React.createElement('input', {
          id: id,
          className: 'dsh-folded-chat-switch',
          type: 'checkbox',
          role: 'switch',
          checked: checked,
          'aria-checked': checked ? 'true' : 'false',
          onChange: onChange,
        }),
      )
    }

    return React.createElement('li', {
      className: 'dsh-folded-chat-card',
      'data-open': open ? 'true' : 'false',
    },
    React.createElement('button', {
      type: 'button',
      className: 'dsh-folded-chat-card-header',
      'aria-expanded': open ? 'true' : 'false',
      onClick: function () { setOpen(!open) },
    },
    React.createElement('span', { className: 'dsh-folded-chat-card-head' },
      React.createElement('span', { className: 'dsh-folded-chat-card-name' }, t('cardTitle')),
      React.createElement('span', { className: 'dsh-folded-chat-card-sub' }, t('cardSubtitle')),
    ),
    React.createElement('span', {
      className: 'dsh-folded-chat-card-chevron',
      'aria-hidden': 'true',
      dangerouslySetInnerHTML: { __html: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.2 6 8 11.8 12.8 6z"/></svg>' },
    }),
    ),
    open
      ? React.createElement('div', { className: 'dsh-folded-chat-card-body' },
        row('dsh-folded-chat-enable', t('enable'), prefs.enabled, toggle('enabled')),
        row('dsh-folded-chat-outer', t('collapseProcess'), prefs.collapseOuter, toggle('collapseOuter')),
        row('dsh-folded-chat-inner', t('collapseTools'), prefs.collapseInner, toggle('collapseInner')),
      )
      : null,
    )
  }
}

export function registerSettings(ctx, React, store, t) {
  const slots = ctx.get('slots')
  if (slots == null || React == null) return function () {}
  const Card = createSettingsCard(React, store, t)
  return slots.inject('settings.plugin.item', function () {
    return slots.register({
      name: 'settings.plugin.item',
      id: 'dsh-folded-chat',
      order: 100,
      label: function () { return t('cardTitle') },
    }, Card)
  })
}
