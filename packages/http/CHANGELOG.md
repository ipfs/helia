# Changelog

## [1.0.5](https://github.com/ipfs/helia/compare/http-v1.0.4...http-v1.0.5) (2024-04-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/block-brokers bumped from ^2.1.0 to ^2.1.1

## [1.0.4](https://github.com/ipfs/helia/compare/http-v1.0.3...http-v1.0.4) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/block-brokers bumped from ^2.0.3 to ^2.1.0
    * @helia/interface bumped from ^4.1.0 to ^4.2.0
    * @helia/routers bumped from ^1.0.2 to ^1.0.3
    * @helia/utils bumped from ^0.1.0 to ^0.2.0

## [1.0.3](https://github.com/ipfs/helia/compare/http-v1.0.2...http-v1.0.3) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/block-brokers bumped from ^2.0.2 to ^2.0.3
    * @helia/interface bumped from ^4.0.1 to ^4.1.0
    * @helia/routers bumped from ^1.0.1 to ^1.0.2
    * @helia/utils bumped from ^0.0.2 to ^0.1.0

## [1.0.2](https://github.com/ipfs/helia/compare/http-v1.0.1...http-v1.0.2) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/block-brokers bumped from ^2.0.1 to ^2.0.2
    * @helia/interface bumped from ^4.0.0 to ^4.0.1
    * @helia/routers bumped from ^1.0.0 to ^1.0.1
    * @helia/utils bumped from ^0.0.1 to ^0.0.2

## [1.0.1](https://github.com/ipfs/helia/compare/http-v1.0.0...http-v1.0.1) (2024-01-31)

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/block-brokers bumped from ^2.0.0 to ^2.0.1

## 1.0.0 (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/block-brokers bumped from ^1.0.0 to ^2.0.0
    * @helia/interface bumped from ^3.0.1 to ^4.0.0
    * @helia/routers bumped from ^0.0.0 to ^1.0.0
    * @helia/utils bumped from ^0.0.0 to ^0.0.1
