<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/json

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-json.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-json)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-json/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-json/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> Add/get IPLD blocks containing json with your Helia node

# About

`@helia/json` makes working with JSON in Helia simple & straightforward.

See the JSON interface for all available operations.

## Example

```typescript
import { createHelia } from 'helia'
import { json } from '@helia/json'
import { CID } from 'multiformats/cid'

const j = json(helia)
const cid = await j.put({
  hello: 'world'
})
const obj = await j.get(cid)

console.info(obj)
// { hello: 'world' }
```

# Install

```console
$ npm i @helia/json
```

## Browser `<script>` tag

Loading this module through a script tag will make it's exports available as `HeliaJson` in the global namespace.

```html
<script src="https://unpkg.com/@helia/json/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia-json/modules/_helia_json.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia-json/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
