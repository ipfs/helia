<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/ipns

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

> An implementation of IPNS for Helia

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

IPNS operations using a Helia node

## Example - Getting started

With IPNSRouting routers:

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { unixfs } from '@helia/unixfs'
import { generateKeyPair } from '@libp2p/crypto/keys'

const helia = await createHelia()
const name = ipns(helia)

// create a keypair to publish an IPNS name
const privateKey = await generateKeyPair('Ed25519')

// store some data to publish
const fs = unixfs(helia)
const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))

// publish the name
await name.publish(privateKey, cid)

// resolve the name
const result = await name.resolve(privateKey.publicKey)

console.info(result.cid, result.path)
```

## Example - Publishing a recursive record

A recursive record is a one that points to another record rather than to a
value.

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { unixfs } from '@helia/unixfs'
import { generateKeyPair } from '@libp2p/crypto/keys'

const helia = await createHelia()
const name = ipns(helia)

// create a keypair to publish an IPNS name
const privateKey = await generateKeyPair('Ed25519')

// store some data to publish
const fs = unixfs(helia)
const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))

// publish the name
await name.publish(privateKey, cid)

// create another keypair to re-publish the original record
const recursivePrivateKey = await generateKeyPair('Ed25519')

// publish the recursive name
await name.publish(recursivePrivateKey, privateKey.publicKey)

// resolve the name recursively - it resolves until a CID is found
const result = await name.resolve(recursivePrivateKey.publicKey)
console.info(result.cid.toString() === cid.toString()) // true
```

## Example - Publishing a record with a path

It is possible to publish CIDs with an associated path.

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { unixfs } from '@helia/unixfs'
import { generateKeyPair } from '@libp2p/crypto/keys'

const helia = await createHelia()
const name = ipns(helia)

// create a keypair to publish an IPNS name
const privateKey = await generateKeyPair('Ed25519')

// store some data to publish
const fs = unixfs(helia)
const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))

// store the file in a directory
const dirCid = await fs.addDirectory()
const finalDirCid = await fs.cp(fileCid, dirCid, '/foo.txt')

// publish the name
await name.publish(privateKey, `/ipfs/${finalDirCid}/foo.txt`)

// resolve the name
const result = await name.resolve(privateKey.publicKey)

console.info(result.cid, result.path) // QmFoo.. 'foo.txt'
```

## Example - Using custom PubSub router

Additional IPNS routers can be configured - these enable alternative means to
publish and resolve IPNS names.

One example is the PubSub router - this requires an instance of Helia with
libp2p PubSub configured.

It works by subscribing to a pubsub topic for each IPNS name that we try to
resolve. Updated IPNS records are shared on these topics so an update must
occur before the name is resolvable.

This router is only suitable for networks where IPNS updates are frequent
and multiple peers are listening on the topic(s), otherwise update messages
may fail to be published with "Insufficient peers" errors.

```TypeScript
import { createHelia, libp2pDefaults } from 'helia'
import { ipns } from '@helia/ipns'
import { pubsub } from '@helia/ipns/routing'
import { unixfs } from '@helia/unixfs'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { generateKeyPair } from '@libp2p/crypto/keys'
import type { Libp2p, PubSub } from '@libp2p/interface'
import type { DefaultLibp2pServices } from 'helia'

const libp2pOptions = libp2pDefaults()
libp2pOptions.services.pubsub = gossipsub()

const helia = await createHelia<Libp2p<DefaultLibp2pServices & { pubsub: PubSub }>>({
  libp2p: libp2pOptions
})
const name = ipns(helia, {
 routers: [
   pubsub(helia)
 ]
})

// create a keypair to publish an IPNS name
const privateKey = await generateKeyPair('Ed25519')

// store some data to publish
const fs = unixfs(helia)
const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))

// publish the name
await name.publish(privateKey, cid)

// resolve the name
const result = await name.resolve(privateKey.publicKey)
```

## Example - Using custom DNS over HTTPS resolvers

To use custom resolvers, configure Helia's `dns` option:

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { dns } from '@multiformats/dns'
import { dnsOverHttps } from '@multiformats/dns/resolvers'
import { helia } from '@helia/ipns/routing'

const node = await createHelia({
  dns: dns({
    resolvers: {
      '.': dnsOverHttps('https://private-dns-server.me/dns-query')
    }
  })
})
const name = ipns(node, {
 routers: [
   helia(node.routing)
 ]
})

const result = name.resolveDNSLink('some-domain-with-dnslink-entry.com')
```

## Example - Resolving a domain with a dnslink entry

Calling `resolveDNSLink` with the `@helia/ipns` instance:

```TypeScript
// resolve a CID from a TXT record in a DNS zone file, using the default
// resolver for the current platform eg:
// > dig _dnslink.ipfs.io TXT
// ;; ANSWER SECTION:
// _dnslink.ipfs.io.          60     IN      TXT     "dnslink=/ipns/website.ipfs.io"
// > dig _dnslink.website.ipfs.io TXT
// ;; ANSWER SECTION:
// _dnslink.website.ipfs.io.  60     IN      TXT     "dnslink=/ipfs/QmWebsite"

import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'

const node = await createHelia()
const name = ipns(node)

const { answer } = await name.resolveDNSLink('ipfs.io')

console.info(answer)
// { data: '/ipfs/QmWebsite' }
```

## Example - Using DNS-Over-HTTPS

This example uses the Mozilla provided RFC 1035 DNS over HTTPS service. This
uses binary DNS records so requires extra dependencies to process the
response which can increase browser bundle sizes.

If this is a concern, use the DNS-JSON-Over-HTTPS resolver instead.

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { dns } from '@multiformats/dns'
import { dnsOverHttps } from '@multiformats/dns/resolvers'

const node = await createHelia({
  dns: dns({
    resolvers: {
      '.': dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
    }
  })
})
const name = ipns(node)

const result = await name.resolveDNSLink('ipfs.io')
```

## Example - Using DNS-JSON-Over-HTTPS

DNS-JSON-Over-HTTPS resolvers use the RFC 8427 `application/dns-json` and can
result in a smaller browser bundle due to the response being plain JSON.

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { dns } from '@multiformats/dns'
import { dnsJsonOverHttps } from '@multiformats/dns/resolvers'

const node = await createHelia({
  dns: dns({
    resolvers: {
      '.': dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
    }
  })
})
const name = ipns(node)

const result = await name.resolveDNSLink('ipfs.io')
```

## Example - Republishing an existing IPNS record

The `republishRecord` method allows you to republish an existing IPNS record without
needing the private key. This is useful for relay nodes or when you want to extend
the availability of a record that was created elsewhere.

```TypeScript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { CID } from 'multiformats/cid'

const helia = await createHelia()
const name = ipns(helia)

const ipnsName = 'k51qzi5uqu5dktsyfv7xz8h631pri4ct7osmb43nibxiojpttxzoft6hdyyzg4'
const parsedCid: CID<unknown, 114, 0 | 18, 1> = CID.parse(ipnsName)
const delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')
const record = await delegatedClient.getIPNS(parsedCid)

await name.republishRecord(ipnsName, record)
```

# Install

```console
$ npm i @helia/ipns
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
