<p align="center">
  <a href="https://github.com/ipfs/helia-http" title="helia-http">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

> A lightweight implementation of IPFS over HTTP in JavaScript

# About

Exports a `createHeliaHTTP` function that returns an object that implements a lightweight version of the Helia API that functions only over HTTP.

By default, content and peer routing are requests are resolved using the [Delegated HTTP Routing API](https://specs.ipfs.tech/routing/http-routing-v1/) and blocks are fetched from [Trustless Gateways](https://specs.ipfs.tech/http-gateways/trustless-gateway/).

Pass it to other modules like @helia/unixfs to fetch files from the distributed web.

## Example

```typescript
import { createHeliaHTTP } from '@helia/http'
import { unixfs } from '@helia/unixfs'
import { CID } from 'multiformats/cid'

const helia = await createHeliaHTTP()

const fs = unixfs(helia)
fs.cat(CID.parse('bafyFoo'))
```

## Example - with custom gateways and delegated routing endpoints

```typescript
import { createHeliaHTTP } from '@helia/http'
import { trustlessGateway } from '@helia/block-brokers'
import { delegatedHTTPRouting } from '@helia/routers'
import { unixfs } from '@helia/unixfs'
import { CID } from 'multiformats/cid'

const helia = await createHeliaHTTP({
  blockBrokers: [
    trustlessGateway({
      gateways: ['https://cloudflare-ipfs.com', 'https://ipfs.io'],
    }),
  ],
  routers: [
    delegatedHTTPRouting('https://delegated-ipfs.dev')
  ]
})

const fs = unixfs(helia)
fs.cat(CID.parse('bafyFoo'))
```

# Install

```console
$ npm i @helia/http
```

## Browser `<script>` tag

Loading this module through a script tag will make it's exports available as `HeliaHttp` in the global namespace.

```html
<script src="https://unpkg.com/@helia/http/dist/index.min.js"></script>
```

# Helia-http

# API Docs

- <https://ipfs.github.io/helia/modules/_helia_http.html>

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
