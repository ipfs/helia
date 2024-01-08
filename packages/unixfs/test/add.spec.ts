/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import all from 'it-all'
import last from 'it-last'
import { isNode } from 'wherearewe'
import { globSource, unixfs, urlSource, type UnixFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('addAll', () => {
  let blockstore: Blockstore
  let fs: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
  })

  it('adds a stream of files', async () => {
    const output = await all(fs.addAll([{
      path: './foo.txt',
      content: Uint8Array.from([0, 1, 2, 3, 4])
    }, {
      path: './bar.txt',
      content: Uint8Array.from([5, 4, 3, 2, 1])
    }]))

    expect(output).to.have.lengthOf(2)
    expect(output[0].cid.toString()).to.equal('bafkreiaixnpf23vkyecj5xqispjq5ubcwgsntnnurw2bjby7khe4wnjihu')
    expect(output[1].cid.toString()).to.equal('bafkreidmuy2n45xj3cdknzprtzo2uvgm3hak6mzy5sllxty457agsftd34')
  })

  it('recursively adds a directory', async function () {
    if (!isNode) {
      return this.skip()
    }

    const res = await last(fs.addAll(globSource('./test/fixtures', 'files/**/*')))

    expect(res?.cid.toString()).to.equal('bafybeievhllpjjjbyg53g74wcl5hckdccjjj7zgtexqcacjegoduegnkyu')
  })
})

describe('addBytes', () => {
  let blockstore: Blockstore
  let fs: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
  })

  it('adds bytes', async () => {
    const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))

    expect(cid.toString()).to.equal('bafkreiaixnpf23vkyecj5xqispjq5ubcwgsntnnurw2bjby7khe4wnjihu')
  })
})

describe('addByteStream', () => {
  let blockstore: Blockstore
  let fs: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
  })

  it('adds bytes', async () => {
    const cid = await fs.addByteStream([Uint8Array.from([0, 1, 2, 3, 4])])

    expect(cid.toString()).to.equal('bafkreiaixnpf23vkyecj5xqispjq5ubcwgsntnnurw2bjby7khe4wnjihu')
  })
})

describe('addFile', () => {
  let blockstore: Blockstore
  let fs: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
  })

  it('adds a file', async () => {
    const cid = await fs.addFile({
      content: Uint8Array.from([0, 1, 2, 3, 4])
    })

    expect(cid.toString()).to.equal('bafkreiaixnpf23vkyecj5xqispjq5ubcwgsntnnurw2bjby7khe4wnjihu')
  })

  it('adds a file from a URL', async () => {
    const cid = await fs.addFile(urlSource(new URL(`${process.env.ECHO_SERVER}/download?data=hello-world`)))

    expect(cid.toString()).to.equal('bafkreifpuj5ujvb3aku75ja5cphnylsac3h47b6f3p4zbzmtm2nkrtrinu')
  })
})

describe('addDirectory', () => {
  let blockstore: Blockstore
  let fs: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
  })

  it('adds an empty directory with cidv0', async () => {
    const cid = await fs.addDirectory({}, {
      cidVersion: 0
    })

    expect(cid.toString()).to.equal('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  })

  it('adds an empty directory with no args', async () => {
    const cid = await fs.addDirectory()

    expect(cid.toString()).to.equal('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  })
})
