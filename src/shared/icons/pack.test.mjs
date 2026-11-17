// Run with `npm test` (Node's built-in runner; TypeScript is type-stripped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultPackFile,
  defaultSubsetFile,
  iconPlace,
  isIconFileName,
  readPackMeta,
  readSubsetMeta,
  splitIconPath
} from './pack.ts'

test('a pack without a metadata file is named after its folder', () => {
  const { meta, problems } = readPackMeta(undefined, 'AWS')
  assert.deepEqual(meta, { name: 'AWS', description: '', ifMissing: '', version: '' })
  assert.deepEqual(problems, [])
})

test('the fields of pack.json are read, and an empty text is the same as no field', () => {
  const text = JSON.stringify({
    name: ' AWS Architecture ',
    description: 'Service icons',
    ifMissing: 'Download them from the vendor and install the folder.',
    version: '2024.10',
    extra: 'ignored'
  })
  const { meta, problems } = readPackMeta(text, 'aws-folder')
  assert.equal(meta.name, 'AWS Architecture')
  assert.equal(meta.description, 'Service icons')
  assert.equal(meta.ifMissing, 'Download them from the vendor and install the folder.')
  assert.equal(meta.version, '2024.10')
  assert.deepEqual(problems, [])
  const empty = readPackMeta('{"name":"","version":""}', 'folder')
  assert.equal(empty.meta.name, 'folder')
  assert.deepEqual(empty.problems, [])
})

test('a metadata file that cannot be used is reported and the pack still has a name', () => {
  for (const text of ['{not json', '[1,2]', '"text"', 'null']) {
    const { meta, problems } = readPackMeta(text, 'Folder')
    assert.equal(meta.name, 'Folder', text)
    assert.equal(problems.length, 1, text)
  }
  const wrong = readPackMeta('{"name":5,"version":["1"]}', 'Folder')
  assert.equal(wrong.meta.name, 'Folder')
  assert.equal(wrong.problems.length, 2)
})

test('control characters are replaced and long texts are cut', () => {
  const { meta } = readPackMeta(
    JSON.stringify({
      name: 'A\u0000B\nC',
      version: 'v'.repeat(500),
      description: 'd'.repeat(5000)
    }),
    'F'
  )
  assert.equal(meta.name, 'A B C')
  assert.equal(meta.version.length, 50)
  assert.equal(meta.description.length, 1000)
})

test('a subset has a name and a description', () => {
  assert.deepEqual(readSubsetMeta(undefined, 'Compute').meta, { name: 'Compute', description: '' })
  const { meta } = readSubsetMeta(
    '{"name":"Compute services","description":"EC2 and friends"}',
    'Compute'
  )
  assert.deepEqual(meta, { name: 'Compute services', description: 'EC2 and friends' })
})

test('the default files read back as the folder name with nothing else', () => {
  const pack = defaultPackFile('My icons')
  assert.ok(pack.endsWith('\n'))
  assert.deepEqual(readPackMeta(pack, 'x').meta, {
    name: 'My icons',
    description: '',
    ifMissing: '',
    version: ''
  })
  assert.deepEqual(readSubsetMeta(defaultSubsetFile('Compute'), 'x').meta, {
    name: 'Compute',
    description: ''
  })
})

test('only SVG files are icons', () => {
  assert.equal(isIconFileName('EC2.svg'), true)
  assert.equal(isIconFileName('EC2.SVG'), true)
  assert.equal(isIconFileName('EC2.png'), false)
  assert.equal(isIconFileName('.svg'), false)
  assert.equal(isIconFileName('pack.json'), false)
})

test('an icon path is a subset folder and a file name, and nothing that leaves them', () => {
  assert.deepEqual(splitIconPath('Compute/EC2.svg'), { subset: 'Compute', file: 'EC2.svg' })
  assert.deepEqual(splitIconPath('Arch Services/Amazon EC2 (v2).svg'), {
    subset: 'Arch Services',
    file: 'Amazon EC2 (v2).svg'
  })
  const refused = [
    '',
    'EC2.svg',
    'a/b/c.svg',
    '../EC2.svg',
    'Compute/../EC2.svg',
    './EC2.svg',
    '/EC2.svg',
    '/etc/passwd.svg',
    'Compute//EC2.svg',
    'Compute\\EC2.svg',
    'C:/EC2.svg',
    'Compute/EC2.png',
    'Compute/.svg',
    'Compute/EC2.svg.',
    'Compute/EC2.svg ',
    'Compute/CON.svg',
    'aux/EC2.svg',
    'Compute/lpt1.svg',
    'Compute/a\u0000b.svg',
    'Compute/a|b.svg',
    'Compute/a?.svg'
  ]
  for (const path of refused) assert.equal(splitIconPath(path), null, JSON.stringify(path))
  for (const path of [undefined, null, 5, {}, ['a/b.svg']]) assert.equal(splitIconPath(path), null)
})

test('the place of an icon names its pack, subset and file', () => {
  assert.equal(iconPlace('AWS', 'Compute/EC2.svg'), 'AWS/Compute/EC2.svg')
})
