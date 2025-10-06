<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/dnslink

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

> DNSLink operations using Helia

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

[DNSLink](https://dnslink.dev/) operations using a Helia node.

## Example - Using custom DNS over HTTPS resolvers

To use custom resolvers, configure Helia's `dns` option:

```TypeScript
import { createHelia } from 'helia'
import { dnsLink } from '@helia/dnslink'
import { dns } from '@multiformats/dns'
import { dnsOverHttps } from '@multiformats/dns/resolvers'
import type { DefaultLibp2pServices } from 'helia'
import type { Libp2p } from '@libp2p/interface'

const node = await createHelia<Libp2p<DefaultLibp2pServices>>({
  dns: dns({
    resolvers: {
      '.': dnsOverHttps('https://private-dns-server.me/dns-query')
    }
  })
})
const name = dnsLink(node)

const result = name.resolve('some-domain-with-dnslink-entry.com')
```

## Example - Resolving a domain with a dnslink entry

Calling `resolve` with the `@helia/dnslink` instance:

```TypeScript
// resolve a CID from a TXT record in a DNS zone file, using the default
// resolver for the current platform eg:
// > dig _dnslink.ipfs.tech TXT
// ;; ANSWER SECTION:
// _dnslink.ipfs.tech. 60 IN CNAME _dnslink.ipfs-tech.on.fleek.co.
// _dnslink.ipfs-tech.on.fleek.co. 120 IN TXT "dnslink=/ipfs/bafybe..."

import { createHelia } from 'helia'
import { dnsLink } from '@helia/dnslink'

const node = await createHelia()
const name = dnsLink(node)

const { answer } = await name.resolve('blog.ipfs.tech')

console.info(answer)
// { data: '/ipfs/bafybe...' }
```

## Example - Using DNS-Over-HTTPS

This example uses the Mozilla provided RFC 1035 DNS over HTTPS service. This
uses binary DNS records so requires extra dependencies to process the
response which can increase browser bundle sizes.

If this is a concern, use the DNS-JSON-Over-HTTPS resolver instead.

```TypeScript
import { createHelia } from 'helia'
import { dnsLink } from '@helia/dnslink'
import { dns } from '@multiformats/dns'
import { dnsOverHttps } from '@multiformats/dns/resolvers'
import type { DefaultLibp2pServices } from 'helia'
import type { Libp2p } from '@libp2p/interface'

const node = await createHelia<Libp2p<DefaultLibp2pServices>>({
  dns: dns({
    resolvers: {
      '.': dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
    }
  })
})
const name = dnsLink(node)

const result = await name.resolve('blog.ipfs.tech')
```

## Example - Using DNS-JSON-Over-HTTPS

DNS-JSON-Over-HTTPS resolvers use the RFC 8427 `application/dns-json` and can
result in a smaller browser bundle due to the response being plain JSON.

```TypeScript
import { createHelia } from 'helia'
import { dnsLink } from '@helia/dnslink'
import { dns } from '@multiformats/dns'
import { dnsJsonOverHttps } from '@multiformats/dns/resolvers'
import type { DefaultLibp2pServices } from 'helia'
import type { Libp2p } from '@libp2p/interface'

const node = await createHelia<Libp2p<DefaultLibp2pServices>>({
  dns: dns({
    resolvers: {
      '.': dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
    }
  })
})
const name = dnsLink(node)

const result = await name.resolve('blog.ipfs.tech')
```

# Install

```console
$ npm i @helia/dnslink
```

## Browser `<script>` tag

Loading this module through a script tag will make its exports available as `HeliaIpns` in the global namespace.

```html
<script src="https://unpkg.com/@helia/ipns/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia/modules/_helia_ipns.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/ipfs/helia/blob/main/packages/ipns/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/ipfs/helia/blob/main/packages/ipns/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
