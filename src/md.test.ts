import assert from 'node:assert/strict'
import { parseMd, toMd, pathFor, varsOf, fillVars } from './md.ts'

const inline = parseMd('Review PR.md', '---\ntags: [code, "review"]\naliases: x\n---\nReview {{lang}} code: {{ code }}')
assert.equal(inline.title, 'Review PR')
assert.deepEqual(inline.tags, ['code', 'review'])
assert.equal(inline.extra, 'aliases: x')
assert.equal(inline.body, 'Review {{lang}} code: {{ code }}')

const list = parseMd('a.md', '---\ntags:\n  - one\n  - "#two"\n---\nbody')
assert.deepEqual(list.tags, ['one', 'two'])

const plain = parseMd('z.md', 'no frontmatter')
assert.deepEqual([plain.title, plain.tags, plain.body], ['z', [], 'no frontmatter'])

// round trip keeps unknown frontmatter
assert.deepEqual(parseMd(inline.id, toMd(inline)), inline)
assert.equal(toMd(plain), 'no frontmatter')

assert.equal(pathFor('a/b?'), 'a-b-.md')
assert.equal(pathFor('..evil'), 'evil.md')
assert.throws(() => pathFor('  '))

assert.deepEqual(varsOf(inline.body).map(v => v.name), ['lang', 'code'])
assert.deepEqual(varsOf('{{lang=ts}} {{tone | formal | casual}} {{lang}}'), [
  { name: 'lang', def: 'ts' },
  { name: 'tone', def: 'formal', options: ['formal', 'casual'] },
])
assert.equal(fillVars('{{lang=ts}}/{{tone|a|b}}/{{x}}', {}), 'ts/a/{{x}}')
assert.equal(fillVars('{{lang=ts}} {{lang}}', { lang: 'go' }), 'go go')

const pinned = parseMd('p.md', '---\npinned: true\ntags: [a]\n---\nbody')
assert.equal(pinned.pinned, true)
assert.equal(pinned.extra, undefined)
assert.deepEqual(parseMd('p.md', toMd(pinned)), pinned)
assert.equal(toMd({ ...pinned, pinned: false }), '---\ntags: [a]\n---\nbody')
assert.equal(fillVars('{{a}} {{ b }} {{c}}', { a: '1', b: '2' }), '1 2 {{c}}')
console.log('md ok')
