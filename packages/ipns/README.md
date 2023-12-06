<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/ipns <!-- omit in toc -->

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-ipns.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-ipns)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-ipns/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-ipns/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> An implementation of IPNS for Helia

# About

IPNS operations using a Helia node

## Example

With IPNSRouting routers:

```typescript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { dht, pubsub } from '@helia/ipns/routing'
import { unixfs } from '@helia/unixfs'

const helia = await createHelia()
const name = ipns(helia, {
 routers: [
   dht(helia),
   pubsub(helia)
 ]
})

// create a public key to publish as an IPNS name
const keyInfo = await helia.libp2p.keychain.createKey('my-key')
const peerId = await helia.libp2p.keychain.exportPeerId(keyInfo.name)

// store some data to publish
const fs = unixfs(helia)
const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))

// publish the name
await name.publish(peerId, cid)

// resolve the name
const cid = name.resolve(peerId)
```

## Example

With default DNSResolver resolvers:

```typescript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { unixfs } from '@helia/unixfs'
import { dnsOverHttps } from '@helia/ipns/dns-resolvers'

const helia = await createHelia()
const name = ipns(helia, {
 resolvers: [
   dnsOverHttps('https://private-dns-server.me/dns-query'),
 ]
})

const cid = name.resolveDns('some-domain-with-dnslink-entry.com')
```

## Example

Calling `resolveDns` with the `@helia/ipns` instance:

```typescript
// resolve a CID from a TXT record in a DNS zone file, using the default
// resolver for the current platform eg:
// > dig _dnslink.ipfs.io TXT
// ;; ANSWER SECTION:
// _dnslink.ipfs.io.          60     IN      TXT     "dnslink=/ipns/website.ipfs.io"
// > dig _dnslink.website.ipfs.io TXT
// ;; ANSWER SECTION:
// _dnslink.website.ipfs.io.  60     IN      TXT     "dnslink=/ipfs/QmWebsite"

const cid = name.resolveDns('ipfs.io')

console.info(cid)
// QmWebsite
```

## Example

This example uses the Mozilla provided RFC 1035 DNS over HTTPS service. This
uses binary DNS records so requires extra dependencies to process the
response which can increase browser bundle sizes.

If this is a concern, use the DNS-JSON-Over-HTTPS resolver instead.

```typescript
// use DNS-Over-HTTPS
import { dnsOverHttps } from '@helia/ipns/dns-resolvers'

const cid = name.resolveDns('ipfs.io', {
  resolvers: [
    dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
  ]
})
```

## Example

DNS-JSON-Over-HTTPS resolvers use the RFC 8427 `application/dns-json` and can
result in a smaller browser bundle due to the response being plain JSON.

```typescript
// use DNS-JSON-Over-HTTPS
import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'

const cid = name.resolveDns('ipfs.io', {
  resolvers: [
    dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
  ]
})
```
