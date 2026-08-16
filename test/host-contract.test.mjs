import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { apply, inject, name } from '../host.js'

test('host plugin is a named function plugin', () => {
  assert.equal(name, 'dsh-folded-chat')
  assert.deepEqual(inject, [])
  assert.equal(typeof apply, 'function')
  apply()
})

test('client bundle is a ModuleLoader factory with matching identity', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(source, /id: 'dsh-folded-chat'/)
  assert.match(source, /var name = 'dsh-folded-chat'/)
  assert.match(source, /var inject = \['timer', 'slots'\]/)
  assert.match(source, /return module\.exports/)
  assert.doesNotMatch(source, /^import /m)
  assert.match(source, /data-conversation-scroll/)
  assert.match(source, /settings\.plugin\.item/)
  assert.match(source, /data-dsh-folded-chat-hidden/)
})
