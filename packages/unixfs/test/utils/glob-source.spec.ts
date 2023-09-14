/* eslint-env mocha */

import fs from 'fs'
import Path from 'path'
import { fileURLToPath } from 'url'
import { expect } from 'aegir/chai'
import all from 'it-all'
import { isNode } from 'wherearewe'
import { globSource } from '../../src/utils/glob-source.js'

function fixtureDir (): string {
  const filename = fileURLToPath(import.meta.url)
  const dirname = Path.dirname(filename)

  return Path.resolve(Path.join(dirname, '..', '..', '..', 'test', 'fixtures', 'files'))
}

function fixture (file: string): string {
  return Path.resolve(Path.join(fixtureDir(), file))
}

function findMode (file: string): number {
  return fs.statSync(fixture(file)).mode
}

function findMtime (file: string): Date {
  return fs.statSync(fixture(file)).mtime
}

describe('glob-source', () => {
  it('single file, relative path', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource('./test/fixtures/files', 'file-0.html'))

    expect(result.length).to.equal(1)
    expect(result[0].path).to.equal('/file-0.html')
  })

  it('single file, absolute path', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), 'file-0.html'))

    expect(result.length).to.equal(1)
    expect(result[0].path).to.equal('/file-0.html')
  })

  it('directory, relative path', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), 'dir/**/*'))

    expect(result).to.have.lengthOf(5)
    expect(result).to.containSubset([{
      path: '/dir/file-1.txt'
    }, {
      path: '/dir/file-2.js'
    }, {
      path: '/dir/file-3.css'
    }, {
      path: '/dir/nested-dir'
    }, {
      path: '/dir/nested-dir/other.txt'
    }])
  })

  it('multiple directories', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), '{dir/nested-dir,another-dir/another-nested-dir}/**/*'))

    expect(result).to.have.lengthOf(2)
    expect(result).to.containSubset([{
      path: '/dir/nested-dir/other.txt'
    }, {
      path: '/another-dir/another-nested-dir/other.txt'
    }])
  })

  it('directory, hidden files', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), 'dir/**/*', {
      hidden: true
    }))

    expect(result).to.have.lengthOf(6)
    expect(result).to.containSubset([{
      path: '/dir/.hidden.txt'
    }])
  })

  it('directory, ignore files', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), 'dir/**/!(file-1.txt)'))

    expect(result).to.have.lengthOf(4)
    expect(result).to.not.containSubset([{
      path: '/dir/file-1.txt'
    }])
  })

  it('multiple paths', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixture('dir'), 'file-{1,2}.*'))

    expect(result).to.have.lengthOf(2)
    expect(result).to.not.containSubset([{
      path: '/dir/file-1.txt'
    }, {
      path: '/dir/file-2.js'
    }])
  })

  it('preserves mode for directories', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), '{dir,dir/**/*}', {
      preserveMode: true
    }))

    expect(result).to.have.lengthOf(6)
    expect(result).to.containSubset([{
      path: '/dir',
      mode: findMode('/dir')
    }, {
      path: '/dir/file-1.txt',
      mode: findMode('/dir/file-1.txt')
    }, {
      path: '/dir/file-2.js',
      mode: findMode('/dir/file-2.js')
    }, {
      path: '/dir/file-3.css',
      mode: findMode('/dir/file-3.css')
    }, {
      path: '/dir/nested-dir',
      mode: findMode('/dir/nested-dir')
    }, {
      path: '/dir/nested-dir/other.txt',
      mode: findMode('/dir/nested-dir/other.txt')
    }])
  })

  it('overrides mode for directories', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), '{dir,dir/**/*}', {
      mode: 5
    }))

    expect(result).to.have.lengthOf(6)
    expect(result).to.containSubset([{
      path: '/dir',
      mode: 5
    }, {
      path: '/dir/file-1.txt',
      mode: 5
    }, {
      path: '/dir/file-2.js',
      mode: 5
    }, {
      path: '/dir/file-3.css',
      mode: 5
    }, {
      path: '/dir/nested-dir',
      mode: 5
    }, {
      path: '/dir/nested-dir/other.txt',
      mode: 5
    }])
  })

  it('preserves mtime for directories', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), '{dir,dir/**/*}', {
      preserveMtime: true
    }))

    expect(result).to.have.lengthOf(6)
    expect(result).to.containSubset([{
      path: '/dir',
      mtime: findMtime('/dir')
    }, {
      path: '/dir/file-1.txt',
      mtime: findMtime('/dir/file-1.txt')
    }, {
      path: '/dir/file-2.js',
      mtime: findMtime('/dir/file-2.js')
    }, {
      path: '/dir/file-3.css',
      mtime: findMtime('/dir/file-3.css')
    }, {
      path: '/dir/nested-dir',
      mtime: findMtime('/dir/nested-dir')
    }, {
      path: '/dir/nested-dir/other.txt',
      mtime: findMtime('/dir/nested-dir/other.txt')
    }])
  })

  it('overrides mtime for directories', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixtureDir(), '{dir,dir/**/*}', {
      mtime: new Date(5)
    }))

    expect(result).to.have.lengthOf(6)
    expect(result).to.containSubset([{
      path: '/dir',
      mtime: new Date(5)
    }, {
      path: '/dir/file-1.txt',
      mtime: new Date(5)
    }, {
      path: '/dir/file-2.js',
      mtime: new Date(5)
    }, {
      path: '/dir/file-3.css',
      mtime: new Date(5)
    }, {
      path: '/dir/nested-dir',
      mtime: new Date(5)
    }, {
      path: '/dir/nested-dir/other.txt',
      mtime: new Date(5)
    }])
  })

  it('overrides mtime for file with secs/nsecs', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixture('dir'), 'file-1.txt', {
      mtime: { secs: 5n, nsecs: 0 }
    }))

    expect(result).to.have.deep.nested.property('[0].mtime', { secs: 5n, nsecs: 0 })
  })

  it('overrides mtime for file with hrtime', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixture('dir'), 'file-1.txt', {
      mtime: [5, 0]
    }))

    expect(result).to.have.deep.nested.property('[0].mtime', [5, 0])
  })

  it('overrides mtime for file with UnixFS timespec', async function () {
    if (!isNode) {
      return this.skip()
    }

    const result = await all(globSource(fixture('dir'), 'file-1.txt', {
      mtime: { Seconds: 5, FractionalNanoseconds: 0 }
    }))

    expect(result).to.have.deep.nested.property('[0].mtime', { Seconds: 5, FractionalNanoseconds: 0 })
  })
})
