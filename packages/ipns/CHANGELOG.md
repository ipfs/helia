## [@helia/ipns-v3.0.0](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v2.0.3...@helia/ipns-v3.0.0) (2023-12-05)


### ⚠ BREAKING CHANGES

* alters the options object passed to the `ipns` factory function

#### Before

```typescript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { dht, pubsub } from '@helia/ipns/routing'
import { unixfs } from '@helia/unixfs'

const helia = await createHelia()
const name = ipns(helia, [
  dht(helia),
  pubsub(helia)
])
```

#### After

```typescript
import { createHelia } from 'helia'
import { ipns } from '@helia/ipns'
import { dnsOverHttps } from '@helia/ipns/dns-resolvers'
import { unixfs } from '@helia/unixfs'

const helia = await createHelia()
const name = ipns(helia, {
  routers: [
    dht(helia),
    pubsub(helia)
  ],
  resolvers: [
    dnsOverHttps('https://private-dns-server.me/dns-query'),
  ]
})
```

### Features

* support DNS over HTTPS and DNS-JSON over HTTPS ([#55](https://github.com/ipfs/helia-ipns/issues/55)) ([2ac0e8b](https://github.com/ipfs/helia-ipns/commit/2ac0e8b26556b73961e67191c564ac2b18d32b31))

## [@helia/ipns-v2.0.3](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v2.0.2...@helia/ipns-v2.0.3) (2023-10-26)


### Bug Fixes

* update libp2p interfaces ([#109](https://github.com/ipfs/helia-ipns/issues/109)) ([514b6e1](https://github.com/ipfs/helia-ipns/commit/514b6e1e4192f700a6f0e769d52a4ec5dfe757ec))

## [@helia/ipns-v2.0.2](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v2.0.1...@helia/ipns-v2.0.2) (2023-10-24)


### Dependencies

* **dev:** bump sinon from 16.1.3 to 17.0.0 ([#108](https://github.com/ipfs/helia-ipns/issues/108)) ([530aeff](https://github.com/ipfs/helia-ipns/commit/530aeff8af103c9126411cc1b035ee106f113f1f))

## [@helia/ipns-v2.0.1](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v2.0.0...@helia/ipns-v2.0.1) (2023-10-07)


### Dependencies

* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#107](https://github.com/ipfs/helia-ipns/issues/107)) ([5402d30](https://github.com/ipfs/helia-ipns/commit/5402d30de1437052e9e9b955d9be3c2898515447))

## [@helia/ipns-v2.0.0](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.7...@helia/ipns-v2.0.0) (2023-09-22)


### ⚠ BREAKING CHANGES

* the `IPNSRecord` type returned from the `publish` method has changed

### Dependencies

* update ipns to v7.x.x ([#106](https://github.com/ipfs/helia-ipns/issues/106)) ([83a1d14](https://github.com/ipfs/helia-ipns/commit/83a1d147e8ba758efd7d2574ea486218bd1f3df2))

## [@helia/ipns-v1.1.7](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.6...@helia/ipns-v1.1.7) (2023-09-15)


### Dependencies

* **dev:** bump sinon from 15.2.0 to 16.0.0 ([#105](https://github.com/ipfs/helia-ipns/issues/105)) ([231ebbd](https://github.com/ipfs/helia-ipns/commit/231ebbd4cda2196d7914a81aa1b0d79473c3a325))

## [@helia/ipns-v1.1.6](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.5...@helia/ipns-v1.1.6) (2023-09-15)


### Dependencies

* **dev:** bump libp2p from 0.45.9 to 0.46.6 ([#92](https://github.com/ipfs/helia-ipns/issues/92)) ([efe02e5](https://github.com/ipfs/helia-ipns/commit/efe02e5b38992189edb40cd34d79e76dca4c34a3))

## [@helia/ipns-v1.1.5](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.4...@helia/ipns-v1.1.5) (2023-09-11)


### Dependencies

* bump @libp2p/logger from 2.1.1 to 3.0.2 ([#87](https://github.com/ipfs/helia-ipns/issues/87)) ([b2886b9](https://github.com/ipfs/helia-ipns/commit/b2886b9598a66a31c69ee0c3c7e13748614be37e))

## [@helia/ipns-v1.1.4](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.3...@helia/ipns-v1.1.4) (2023-09-11)


### Trivial Changes

* update project config ([#99](https://github.com/ipfs/helia-ipns/issues/99)) ([a704fdc](https://github.com/ipfs/helia-ipns/commit/a704fdcbe8507ea97065f40525f0bbc251b57a4d))


### Dependencies

* bump multiformats from 11.0.2 to 12.0.1 ([#57](https://github.com/ipfs/helia-ipns/issues/57)) ([6f93e51](https://github.com/ipfs/helia-ipns/commit/6f93e51e9b6f603f7c1d396705dc5b190108fe79))
* **dev:** bump aegir from 39.0.13 to 40.0.8 ([#65](https://github.com/ipfs/helia-ipns/issues/65)) ([174987b](https://github.com/ipfs/helia-ipns/commit/174987b2817cfe99cbabb9835dd6a2d99c1c35a9))

## [@helia/ipns-v1.1.3](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.2...@helia/ipns-v1.1.3) (2023-05-24)


### Dependencies

* update all deps and fix linting ([4cdba4f](https://github.com/ipfs/helia-ipns/commit/4cdba4fda743e7805725f4155242b93bc74ba4ae))

## [@helia/ipns-v1.1.2](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.1...@helia/ipns-v1.1.2) (2023-05-09)


### Bug Fixes

* cache IPNS entries after resolving ([#35](https://github.com/ipfs/helia-ipns/issues/35)) ([704b413](https://github.com/ipfs/helia-ipns/commit/704b41355768b3e8723560c5f7ed3d7c12b58c3b)), closes [#20](https://github.com/ipfs/helia-ipns/issues/20)

## [@helia/ipns-v1.1.1](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.1.0...@helia/ipns-v1.1.1) (2023-05-05)


### Bug Fixes

* use the content routing api for get/put operations ([#34](https://github.com/ipfs/helia-ipns/issues/34)) ([55208cc](https://github.com/ipfs/helia-ipns/commit/55208ccfdc4f3a799736f29e614910cbd8375a9d))

## [@helia/ipns-v1.1.0](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.0.1...@helia/ipns-v1.1.0) (2023-03-29)


### Features

* allow publish/resolve using only local datastore ([#15](https://github.com/ipfs/helia-ipns/issues/15)) ([43e32a2](https://github.com/ipfs/helia-ipns/commit/43e32a20f44fffd533531a57e6d60883cebc55ca))

## [@helia/ipns-v1.0.1](https://github.com/ipfs/helia-ipns/compare/@helia/ipns-v1.0.0...@helia/ipns-v1.0.1) (2023-03-21)


### Documentation

* fix typos ([#4](https://github.com/ipfs/helia-ipns/issues/4)) ([4369653](https://github.com/ipfs/helia-ipns/commit/4369653892d1434b9519f8f7f93371ae4531bc21))


### Dependencies

* update blockstore/datastore deps ([#10](https://github.com/ipfs/helia-ipns/issues/10)) ([3189737](https://github.com/ipfs/helia-ipns/commit/3189737040a9dfe631e1d07f7f884ff19b873f17))
* update ipns to 6.x.x ([#12](https://github.com/ipfs/helia-ipns/issues/12)) ([6866638](https://github.com/ipfs/helia-ipns/commit/6866638830f32442f9cfeadbde795e74b0865e00))

## @helia/ipns-v1.0.0 (2023-02-15)


### Features

* initial implementation ([#1](https://github.com/ipfs/helia-ipns/issues/1)) ([b176179](https://github.com/ipfs/helia-ipns/commit/b1761795f023e9150201e41f0b9e2c3021425f26))
