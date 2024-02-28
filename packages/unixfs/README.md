<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/unixfs

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

> A Helia-compatible wrapper for UnixFS

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

`@helia/unixfs` is an implementation of a filesystem compatible with Helia.

See the [API docs](https://ipfs.github.io/helia/modules/_helia_unixfs.html) for all available operations.

## Example - Creating files and directories

```typescript
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'

const helia = createHelia({
  // ... helia config
})
const fs = unixfs(helia)

// create an empty dir and a file, then add the file to the dir
const emptyDirCid = await fs.addDirectory()
const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
const updateDirCid = await fs.cp(fileCid, emptyDirCid, 'foo.txt')

// or doing the same thing as a stream
for await (const entry of fs.addAll([{
  path: 'foo.txt',
  content: Uint8Array.from([0, 1, 2, 3])
}])) {
  console.info(entry)
}
```

## Example - Recursively adding a directory

Node.js-compatibly environments only:

```typescript
import { globSource } from '@helia/unixfs'

for await (const entry of fs.addAll(globSource('path/to/containing/dir', 'glob-pattern'))) {
  console.info(entry)
}
```

# Install

```console
$ npm i @helia/unixfs
```

## Browser `<script>` tag

Loading this module through a script tag will make it's exports available as `HeliaUnixfs` in the global namespace.

```html
<script src="https://unpkg.com/@helia/unixfs/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia/modules/_helia_unixfs.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
