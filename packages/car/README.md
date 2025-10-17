<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/car

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

> Import/export car files from Helia

# About

<!--

!IMPORTANT!

Everything in this README between "# About" and "# Install" is automatically
generated and will be overwritten the next time the doc generator is run.

To make changes to this section, please update the @packageDocumentation section
of src/index.js or src/index.ts

To experiment with formatting, please run "npm run docs" from the root of this
repo and examine the changes made.

-->

`@helia/car` provides `import` and `export` methods to read/write Car files
to Helia's blockstore.

See the Car interface for all available operations.

By default it supports `dag-pb`, `dag-cbor`, `dag-json` and `raw` CIDs, more
esoteric DAG walkers can be passed as an init option.

## Example - Exporting a DAG as a CAR file

```typescript
import { createHelia } from 'helia'
import { car } from '@helia/car'
import { CID } from 'multiformats/cid'
import nodeFs from 'node:fs'

const helia = await createHelia()
const cid = CID.parse('QmFoo...')

const c = car(helia)
const out = nodeFs.createWriteStream('example.car')

for await (const buf of c.export(cid, {
  signal: AbortSignal.timeout(5_000)
})) {
  out.write(buf)
}

out.end()
```

## Example - Exporting a part of a UnixFS DAG as a CAR file

Here the graph traversal will start at `root` and include the blocks for
`root`, `/foo`, `/bar`, and all the blocks that make up `baz.txt`.

If there are other files/directories in the UnixFS DAG under `root`, they
will not be included.

`root` will be the only entry in the CAR file roots.

```typescript
import { createHelia } from 'helia'
import { car, UnixFSPath } from '@helia/car'
import { CID } from 'multiformats/cid'
import nodeFs from 'node:fs'

const helia = await createHelia()
const root = CID.parse('QmFoo...')

const c = car(helia)
const out = nodeFs.createWriteStream('example.car')

for await (const buf of c.export(root, {
  signal: AbortSignal.timeout(5_000),
  traversal: new UnixFSPath('/foo/bar/baz.txt')
})) {
  out.write(buf)
}

out.end()
```

## Example - Including traversal path above the root in a CAR

The `includeTraversalBlocks` option will include the traversal blocks in the
CAR when they would otherwise be excluded (for example when the traversal
starts in a parent of the export root).

Here `baz` is the CID for `baz.txt`.

The CAR file will include the blocks for `parent`, `/foo`, `/bar`, and
`/baz.txt`.

`baz` will be the only entry in the CAR file roots.

```typescript
import { createHelia } from 'helia'
import { car, UnixFSPath } from '@helia/car'
import { CID } from 'multiformats/cid'
import nodeFs from 'node:fs'

const helia = await createHelia()
const parent = CID.parse('QmFoo...')
const baz = CID.parse('QmBar...')

const c = car(helia)
const out = nodeFs.createWriteStream('example.car')

for await (const buf of c.export(baz, {
  signal: AbortSignal.timeout(5_000),
  traversal: new UnixFSPath(parent, '/foo/bar/baz.txt'),
  includeTraversalBlocks: true
})) {
  out.write(buf)
}

out.end()
```

## Example - Importing all blocks from a CAR file

```typescript
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { car } from '@helia/car'
import { CarReader } from '@ipld/car'
import { Readable } from 'node:stream'
import nodeFs from 'node:fs'

const helia = await createHelia({
  // ... helia config
})

// import the car
const inStream = nodeFs.createReadStream('example.car')
const reader = await CarReader.fromIterable(inStream)

const c = car(helia)
await c.import(reader, {
  signal: AbortSignal.timeout(5_000)
})
```

# Install

```console
$ npm i @helia/car
```

## Browser `<script>` tag

Loading this module through a script tag will make its exports available as `HeliaCar` in the global namespace.

```html
<script src="https://unpkg.com/@helia/car/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia/modules/_helia_car.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/ipfs/helia/blob/main/packages/car/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/ipfs/helia/blob/main/packages/car/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
