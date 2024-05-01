# Changelog

## [3.0.6](https://github.com/ipfs/helia/compare/mfs-v3.0.5...mfs-v3.0.6) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/unixfs bumped from ^3.0.5 to ^3.0.6

## [3.0.5](https://github.com/ipfs/helia/compare/mfs-v3.0.4...mfs-v3.0.5) (2024-04-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/unixfs bumped from ^3.0.4 to ^3.0.5

## [3.0.4](https://github.com/ipfs/helia/compare/mfs-v3.0.3...mfs-v3.0.4) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/unixfs bumped from ^3.0.3 to ^3.0.4

## [3.0.3](https://github.com/ipfs/helia/compare/mfs-v3.0.2...mfs-v3.0.3) (2024-04-03)

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/unixfs bumped from ^3.0.2 to ^3.0.3

## [3.0.2](https://github.com/ipfs/helia/compare/mfs-v3.0.1...mfs-v3.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/unixfs bumped from ^3.0.1 to ^3.0.2

## [3.0.1](https://github.com/ipfs/helia/compare/mfs-v3.0.0...mfs-v3.0.1) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/unixfs bumped from ^3.0.0 to ^3.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/mfs-v2.0.1...mfs-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0
    * @helia/unixfs bumped from ^2.0.1 to ^3.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/mfs-v1.0.2...mfs-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13

### Features

* update helia to v3 and multiformats to v13 ([9f7dc0a](https://github.com/ipfs/helia/commit/9f7dc0a0581524531501fc062fefb6ba26d99c02))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1
    * @helia/unixfs bumped from ^2.0.0 to ^2.0.1

## [1.0.2](https://github.com/ipfs/helia/compare/mfs-v1.0.1...mfs-v1.0.2) (2023-10-07)


### Dependencies

* **dev:** bump helia from 2.0.1 to 2.0.3 ([#10](https://github.com/ipfs/helia-mfs/issues/10)) ([6911470](https://github.com/ipfs/helia/commit/6911470cb43720798fca571669a166eb3689dad2))

## [1.0.1](https://github.com/ipfs/helia/compare/mfs-v1.0.0...mfs-v1.0.1) (2023-09-08)


### Documentation

* update docs to use MFS style API ([#4](https://github.com/ipfs/helia-mfs/issues/4)) ([88b23b0](https://github.com/ipfs/helia/commit/88b23b0db4ac9da2a9e94291f2db7b10f436ce00))


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#2](https://github.com/ipfs/helia-mfs/issues/2)) ([351fae7](https://github.com/ipfs/helia/commit/351fae7a129e642a6f312c9a61609273dec190bf))

## 1.0.0 (2023-08-14)


### Features

* initial import ([a70f4eb](https://github.com/ipfs/helia/commit/a70f4eb982e377eeeeb6fd4a53f7baf40c09641b))


### Trivial Changes

* fix up missing deps ([0b407a3](https://github.com/ipfs/helia/commit/0b407a3a7e1da8418fad72e6b3631528a912a493))
* use release versions ([0e7ca5e](https://github.com/ipfs/helia/commit/0e7ca5e3422472712bb83044a483a1a1326ea618))
