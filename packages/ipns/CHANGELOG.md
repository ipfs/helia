# Changelog

## [8.0.0](https://github.com/ipfs/helia/compare/ipns-v7.2.3...ipns-v8.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* helia now uses libp2p@2.x.x

### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))


### Dependencies

* **dev:** bump sinon from 18.0.1 to 19.0.2 ([#634](https://github.com/ipfs/helia/issues/634)) ([23e62e1](https://github.com/ipfs/helia/commit/23e62e16b8962bfe982a1bbb157a144382ca7099))
* update kad-dht to 14.0.0 ([#648](https://github.com/ipfs/helia/issues/648)) ([60d8c8a](https://github.com/ipfs/helia/commit/60d8c8a9ff2104302d1c87bcf39258f1da33cd45))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0

## [7.2.3](https://github.com/ipfs/helia/compare/ipns-v7.2.2...ipns-v7.2.3) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* **dev:** bump sinon from 17.0.2 to 18.0.0 ([#536](https://github.com/ipfs/helia/issues/536)) ([62f77df](https://github.com/ipfs/helia/commit/62f77dfbff94a64e9c248f5be54055c18a6427f7))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

## [7.2.2](https://github.com/ipfs/helia/compare/ipns-v7.2.1...ipns-v7.2.2) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [7.2.1](https://github.com/ipfs/helia/compare/ipns-v7.2.0...ipns-v7.2.1) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [7.0.0](https://github.com/ipfs/helia/compare/ipns-v6.0.1...ipns-v7.0.0) (2024-03-14)


### ⚠ BREAKING CHANGES

* requires @helia/interface@4.1.x or later, `resolveDns` has been renamed `resolveDNSLink`

### Features

* use custom DNS resolver in @helia/ipns for DNSLink ([#466](https://github.com/ipfs/helia/issues/466)) ([2c71b6e](https://github.com/ipfs/helia/commit/2c71b6ec8d34dcc722a3914702f67603492c335f)), closes [#369](https://github.com/ipfs/helia/issues/369)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [7.2.0](https://github.com/ipfs/helia/compare/ipns-v7.1.0...ipns-v7.2.0) (2024-04-03)


### Features

* add cache control to IPNS ([#473](https://github.com/ipfs/helia/issues/473)) ([b00f682](https://github.com/ipfs/helia/commit/b00f682647d3687e54bd48f8f68ab79d1e4e96cc))


### Bug Fixes

* respect the IPNS TTL field ([#482](https://github.com/ipfs/helia/issues/482)) ([1561e4a](https://github.com/ipfs/helia/commit/1561e4a106074b94e421a77b0b8776b065e48bc5))

## [7.1.0](https://github.com/ipfs/helia/compare/ipns-v7.0.0...ipns-v7.1.0) (2024-03-15)


### Features

* add `record`/`answer` fields to IPNS results ([#471](https://github.com/ipfs/helia/issues/471)) ([b6765fe](https://github.com/ipfs/helia/commit/b6765fe7632231407c4a8506015ac07e30152190))

## [6.0.1](https://github.com/ipfs/helia/compare/ipns-v6.0.0...ipns-v6.0.1) (2024-02-28)


### Bug Fixes

* remove is-ipfs from @helia/ipns dependencies ([#421](https://github.com/ipfs/helia/issues/421)) ([3851fe2](https://github.com/ipfs/helia/commit/3851fe2df6af337b7e2cabe694bd3dba17748fce))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [6.0.0](https://github.com/ipfs/helia/compare/ipns-v5.0.0...ipns-v6.0.0) (2024-01-31)


### ⚠ BREAKING CHANGES

* to support paths in `@helia/ipns`, the return type of `ipns.resolve` is now `{ path: string, cid: CID }` instead of just `CID`

### Features

* support paths in @helia/ipns ([#410](https://github.com/ipfs/helia/issues/410)) ([ca8d5eb](https://github.com/ipfs/helia/commit/ca8d5ebdf587574c7fb84517b558226c3479caa9))


### Bug Fixes

* export IPNSRoutingEvents ([#407](https://github.com/ipfs/helia/issues/407)) ([44f4e88](https://github.com/ipfs/helia/commit/44f4e88030a21d86b2a8473d3d00efb624cfce8f))

## [5.0.0](https://github.com/ipfs/helia/compare/ipns-v4.0.0...ipns-v5.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* remove gossipsub from default libp2p services ([#401](https://github.com/ipfs/helia/issues/401))
* `helia.routing` is the default routing used, the `libp2p` routing has been removed as it is redundant
* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))
* use helia router for IPNS put/get ([#387](https://github.com/ipfs/helia/issues/387)) ([ce74026](https://github.com/ipfs/helia/commit/ce740268e83f50e6f144b74969a98d54005cd852))


### Bug Fixes

* remove gossipsub from default libp2p services ([#401](https://github.com/ipfs/helia/issues/401)) ([99c94f4](https://github.com/ipfs/helia/commit/99c94f4b85c4ed826a6195207e3545cbbc87a6d1))
* update ipns module to v9 and fix double verification of records ([#396](https://github.com/ipfs/helia/issues/396)) ([f2853f8](https://github.com/ipfs/helia/commit/f2853f8bd5bdcee8ab7a685355b0be47f29620e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## [4.0.0](https://github.com/ipfs/helia/compare/ipns-v3.0.1...ipns-v4.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3, renames `dht` routing to `libp2p`

### Features

* update helia to v3 and multiformats to v13 ([#167](https://github.com/ipfs/helia-ipns/issues/167)) ([a0381b9](https://github.com/ipfs/helia/commit/a0381b95051bbf3edfa4f53e0ae2d5f43c1e4382))


### Bug Fixes

* make @libp2p/interface a dependency ([#159](https://github.com/ipfs/helia-ipns/issues/159)) ([546ecf0](https://github.com/ipfs/helia/commit/546ecf023bd619d32e187fa6a55d39fcf12e4bbe)), closes [#158](https://github.com/ipfs/helia-ipns/issues/158)


## [3.0.1](https://github.com/ipfs/helia/compare/ipns-v3.0.0...ipns-v3.0.1) (2023-12-08)


### Trivial Changes

* fix docs and aegir dep in subpackages ([#142](https://github.com/ipfs/helia-ipns/issues/142)) ([f66dd71](https://github.com/ipfs/helia/commit/f66dd71f18dab57471749e6a708917ea291d05e1))
* update sibling dependencies ([6ab5ddc](https://github.com/ipfs/helia/commit/6ab5ddcecb377bf61b6a4566292249fd5dc3d2c7))
* update sibling dependencies ([d0d84f0](https://github.com/ipfs/helia/commit/d0d84f07db9338ccc8245167929bd71f4cb8b238))


### Documentation

* fix typo ([#113](https://github.com/ipfs/helia-ipns/issues/113)) ([d732db9](https://github.com/ipfs/helia/commit/d732db9f4fea23aa11456d451f02d4f143846ba3))

## [3.0.0](https://github.com/ipfs/helia/compare/ipns-v2.0.3...ipns-v3.0.0) (2023-12-05)


### ⚠ BREAKING CHANGES

* alters the options object passed to the `ipns` factory function

### Features

* support DNS over HTTPS and DNS-JSON over HTTPS ([#55](https://github.com/ipfs/helia-ipns/issues/55)) ([2ac0e8b](https://github.com/ipfs/helia/commit/2ac0e8b26556b73961e67191c564ac2b18d32b31))

## [2.0.3](https://github.com/ipfs/helia/compare/ipns-v2.0.2...ipns-v2.0.3) (2023-10-26)


### Bug Fixes

* update libp2p interfaces ([#109](https://github.com/ipfs/helia-ipns/issues/109)) ([514b6e1](https://github.com/ipfs/helia/commit/514b6e1e4192f700a6f0e769d52a4ec5dfe757ec))

## [2.0.2](https://github.com/ipfs/helia/compare/ipns-v2.0.1...ipns-v2.0.2) (2023-10-24)


### Dependencies

* **dev:** bump sinon from 16.1.3 to 17.0.0 ([#108](https://github.com/ipfs/helia-ipns/issues/108)) ([530aeff](https://github.com/ipfs/helia/commit/530aeff8af103c9126411cc1b035ee106f113f1f))

## [2.0.1](https://github.com/ipfs/helia/compare/ipns-v2.0.0...ipns-v2.0.1) (2023-10-07)


### Dependencies

* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#107](https://github.com/ipfs/helia-ipns/issues/107)) ([5402d30](https://github.com/ipfs/helia/commit/5402d30de1437052e9e9b955d9be3c2898515447))

## [2.0.0](https://github.com/ipfs/helia/compare/ipns-v1.1.7...ipns-v2.0.0) (2023-09-22)


### ⚠ BREAKING CHANGES

* the `IPNSRecord` type returned from the `publish` method has changed

### Dependencies

* update ipns to v7.x.x ([#106](https://github.com/ipfs/helia-ipns/issues/106)) ([83a1d14](https://github.com/ipfs/helia/commit/83a1d147e8ba758efd7d2574ea486218bd1f3df2))

## [1.1.7](https://github.com/ipfs/helia/compare/ipns-v1.1.6...ipns-v1.1.7) (2023-09-15)


### Dependencies

* **dev:** bump sinon from 15.2.0 to 16.0.0 ([#105](https://github.com/ipfs/helia-ipns/issues/105)) ([231ebbd](https://github.com/ipfs/helia/commit/231ebbd4cda2196d7914a81aa1b0d79473c3a325))

## [1.1.6](https://github.com/ipfs/helia/compare/ipns-v1.1.5...ipns-v1.1.6) (2023-09-15)


### Dependencies

* **dev:** bump libp2p from 0.45.9 to 0.46.6 ([#92](https://github.com/ipfs/helia-ipns/issues/92)) ([efe02e5](https://github.com/ipfs/helia/commit/efe02e5b38992189edb40cd34d79e76dca4c34a3))

## [1.1.5](https://github.com/ipfs/helia/compare/ipns-v1.1.4...ipns-v1.1.5) (2023-09-11)


### Dependencies

* bump @libp2p/logger from 2.1.1 to 3.0.2 ([#87](https://github.com/ipfs/helia-ipns/issues/87)) ([b2886b9](https://github.com/ipfs/helia/commit/b2886b9598a66a31c69ee0c3c7e13748614be37e))

## [1.1.4](https://github.com/ipfs/helia/compare/ipns-v1.1.3...ipns-v1.1.4) (2023-09-11)


### Trivial Changes

* update project config ([#99](https://github.com/ipfs/helia-ipns/issues/99)) ([a704fdc](https://github.com/ipfs/helia/commit/a704fdcbe8507ea97065f40525f0bbc251b57a4d))


### Dependencies

* bump multiformats from 11.0.2 to 12.0.1 ([#57](https://github.com/ipfs/helia-ipns/issues/57)) ([6f93e51](https://github.com/ipfs/helia/commit/6f93e51e9b6f603f7c1d396705dc5b190108fe79))
* **dev:** bump aegir from 39.0.13 to 40.0.8 ([#65](https://github.com/ipfs/helia-ipns/issues/65)) ([174987b](https://github.com/ipfs/helia/commit/174987b2817cfe99cbabb9835dd6a2d99c1c35a9))

## [1.1.3](https://github.com/ipfs/helia/compare/ipns-v1.1.2...ipns-v1.1.3) (2023-05-24)


### Dependencies

* update all deps and fix linting ([4cdba4f](https://github.com/ipfs/helia/commit/4cdba4fda743e7805725f4155242b93bc74ba4ae))

## [1.1.2](https://github.com/ipfs/helia/compare/ipns-v1.1.1...ipns-v1.1.2) (2023-05-09)


### Bug Fixes

* cache IPNS entries after resolving ([#35](https://github.com/ipfs/helia-ipns/issues/35)) ([704b413](https://github.com/ipfs/helia/commit/704b41355768b3e8723560c5f7ed3d7c12b58c3b)), closes [#20](https://github.com/ipfs/helia-ipns/issues/20)

## [1.1.1](https://github.com/ipfs/helia/compare/ipns-v1.1.0...ipns-v1.1.1) (2023-05-05)


### Bug Fixes

* use the content routing api for get/put operations ([#34](https://github.com/ipfs/helia-ipns/issues/34)) ([55208cc](https://github.com/ipfs/helia/commit/55208ccfdc4f3a799736f29e614910cbd8375a9d))

## [1.1.0](https://github.com/ipfs/helia/compare/ipns-v1.0.1...ipns-v1.1.0) (2023-03-29)


### Features

* allow publish/resolve using only local datastore ([#15](https://github.com/ipfs/helia-ipns/issues/15)) ([43e32a2](https://github.com/ipfs/helia/commit/43e32a20f44fffd533531a57e6d60883cebc55ca))

## [1.0.1](https://github.com/ipfs/helia/compare/ipns-v1.0.0...ipns-v1.0.1) (2023-03-21)


### Documentation

* fix typos ([#4](https://github.com/ipfs/helia-ipns/issues/4)) ([4369653](https://github.com/ipfs/helia/commit/4369653892d1434b9519f8f7f93371ae4531bc21))


### Dependencies

* update blockstore/datastore deps ([#10](https://github.com/ipfs/helia-ipns/issues/10)) ([3189737](https://github.com/ipfs/helia/commit/3189737040a9dfe631e1d07f7f884ff19b873f17))
* update ipns to 6.x.x ([#12](https://github.com/ipfs/helia-ipns/issues/12)) ([6866638](https://github.com/ipfs/helia/commit/6866638830f32442f9cfeadbde795e74b0865e00))

## 1.0.0 (2023-02-15)


### Features

* initial implementation ([#1](https://github.com/ipfs/helia-ipns/issues/1)) ([b176179](https://github.com/ipfs/helia/commit/b1761795f023e9150201e41f0b9e2c3021425f26))
