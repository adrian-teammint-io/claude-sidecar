import assert from 'node:assert/strict'
import { parseMd, toMd, pathFor, varsOf, fillVars } from './md.ts'

const inline = parseMd('Coding/Review PR.md', '---\ntags: [code, "review"]\naliases: x\n---\nReview {{lang}} code: {{ code }}')
assert.equal(inline.folder, 'Coding')
assert.equal(inline.title, 'Review PR')
assert.deepEqual(inline.tags, ['code', 'review'])
assert.equal(inline.extra, 'aliases: x')
assert.equal(inline.body, 'Review {{lang}} code: {{ code }}')

const list = parseMd('a.md', '---\ntags:\n  - one\n  - "#two"\n---\nbody')
assert.deepEqual(list.tags, ['one', 'two'])
assert.equal(list.folder, '')

const plain = parseMd('x/y/z.md', 'no frontmatter')
assert.deepEqual([plain.folder, plain.tags, plain.body], ['x/y', [], 'no frontmatter'])

// round trip keeps unknown frontmatter
assert.deepEqual(parseMd(inline.id, toMd(inline)), inline)
assert.equal(toMd(plain), 'no frontmatter')

assert.equal(pathFor('Coding/ sub ', 'a/b?'), 'Coding/sub/a-b-.md')
assert.equal(pathFor('', '..evil'), 'evil.md')
assert.throws(() => pathFor('x', '  '))

assert.deepEqual(varsOf(inline.body), ['lang', 'code'])
assert.equal(fillVars('{{a}} {{ b }} {{c}}', { a: '1', b: '2' }), '1 2 {{c}}')
console.log('md ok')
