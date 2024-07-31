# Changelog

## [3.0.5](https://github.com/ipfs/helia/compare/dag-cbor-v3.0.4...dag-cbor-v3.0.5) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

## [3.0.4](https://github.com/ipfs/helia/compare/dag-cbor-v3.0.3...dag-cbor-v3.0.4) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [3.0.3](https://github.com/ipfs/helia/compare/dag-cbor-v3.0.2...dag-cbor-v3.0.3) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [3.0.2](https://github.com/ipfs/helia/compare/dag-cbor-v3.0.1...dag-cbor-v3.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [3.0.1](https://github.com/ipfs/helia/compare/dag-cbor-v3.0.0...dag-cbor-v3.0.1) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/dag-cbor-v2.0.1...dag-cbor-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/dag-cbor-v1.0.3...dag-cbor-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3

### Features

* update helia to v3 and multiformats to v13 ([#45](https://github.com/ipfs/helia-dag-cbor/issues/45)) ([f078447](https://github.com/ipfs/helia/commit/f078447b6eba4c3d404d62bb930757aa1c0efe74))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1

## [1.0.3](https://github.com/ipfs/helia/compare/dag-cbor-v1.0.2...dag-cbor-v1.0.3) (2023-10-07)


### Dependencies

* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#36](https://github.com/ipfs/helia-dag-cbor/issues/36)) ([77e29bc](https://github.com/ipfs/helia/commit/77e29bcdda33387b8bf15124bc316ef03b434433))

## [1.0.2](https://github.com/ipfs/helia/compare/dag-cbor-v1.0.1...dag-cbor-v1.0.2) (2023-08-27)


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#30](https://github.com/ipfs/helia-dag-cbor/issues/30)) ([aa6ebcf](https://github.com/ipfs/helia/commit/aa6ebcf9f58eebf842113985adee4710b009562d))

## [1.0.1](https://github.com/ipfs/helia/compare/dag-cbor-v1.0.0...dag-cbor-v1.0.1) (2023-08-27)


### Dependencies

* bump multiformats from 11.0.2 to 12.0.1 ([#8](https://github.com/ipfs/helia-dag-cbor/issues/8)) ([7a842d3](https://github.com/ipfs/helia/commit/7a842d3cc4cd97e02e5a196aa512cfe36be4c388))

## 1.0.0 (2023-08-27)


### Features

* initial commit ([ed4c319](https://github.com/ipfs/helia/commit/ed4c319a67c18a3dd65e18f18aa12e82080b3fdc))


### Dependencies

* **dev:** bump aegir from 39.0.13 to 40.0.11 ([#29](https://github.com/ipfs/helia-dag-cbor/issues/29)) ([973bb5b](https://github.com/ipfs/helia/commit/973bb5b6c8db0fedd70e4058f97bc339018a8193))
