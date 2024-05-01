# Changelog

## [1.1.0](https://github.com/ipfs/helia/compare/routers-v1.0.3...routers-v1.1.0) (2024-05-01)


### Features

* add static http gateway routing ([#515](https://github.com/ipfs/helia/issues/515)) ([2d070b9](https://github.com/ipfs/helia/commit/2d070b9cfe0e225e4a66be85cceac900516a8a1f))


### Bug Fixes

* http blockbroker loads gateways from routing ([#519](https://github.com/ipfs/helia/issues/519)) ([6a62d1c](https://github.com/ipfs/helia/commit/6a62d1c8dcfadead0498d0bb59958837dc204c91))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [1.0.3](https://github.com/ipfs/helia/compare/routers-v1.0.2...routers-v1.0.3) (2024-04-15)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [1.0.2](https://github.com/ipfs/helia/compare/routers-v1.0.1...routers-v1.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [1.0.1](https://github.com/ipfs/helia/compare/routers-v1.0.0...routers-v1.0.1) (2024-02-28)


### Bug Fixes

* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## 1.0.0 (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Bug Fixes

* update ipns module to v9 and fix double verification of records ([#396](https://github.com/ipfs/helia/issues/396)) ([f2853f8](https://github.com/ipfs/helia/commit/f2853f8bd5bdcee8ab7a685355b0be47f29620e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0
