<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/car

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-car.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-car)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-car/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-car/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> Import/export car files from Helia

# About

`@helia/car` provides `import` and `export` methods to read/write Car files to Helia's blockstore.

See the Car interface for all available operations.

By default it supports `dag-pb`, `dag-cbor`, `dag-json` and `raw` CIDs, more esoteric DAG walkers can be passed as an init option.

## Example - Exporting a DAG as a CAR file

```typescript
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { car } from '@helia/car'
import { CarWriter } from '@ipld/car'
import { Readable } from 'node:stream'
import nodeFs from 'node:fs'

const helia = createHelia({
  // ... helia config
})
const fs = unixfs(helia)

// add some UnixFS data
const cid = await fs.addBytes(fileData1)

// export it as a Car
const c = car(helia)
const { writer, out } = await CarWriter.create(cid)

// `out` needs to be directed somewhere, see the @ipld/car docs for more information
Readable.from(out).pipe(nodeFs.createWriteStream('example.car'))

// write the DAG behind `cid` into the writer
await c.export(cid, writer)
```

## Example - Importing all blocks from a CAR file

```typescript
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { car } from '@helia/car'
import { CarReader } from '@ipld/car'
import { Readable } from 'node:stream'
import nodeFs from 'node:fs'

const helia = createHelia({
  // ... helia config
})

// import the car
const inStream = nodeFs.createReadStream('example.car')
const reader = await CarReader.fromIterable(inStream)

await c.import(reader)
```

# Install

```console
$ npm i @helia/car
```

## Browser `<script>` tag

Loading this module through a script tag will make it's exports available as `HeliaCar` in the global namespace.

```html
<script src="https://unpkg.com/@helia/car/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia-car/modules/_helia_car.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia-car/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
