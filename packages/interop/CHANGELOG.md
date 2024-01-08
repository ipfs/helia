# Changelog

## [2.0.0](https://github.com/ipfs/helia/compare/interop-v1.1.0...interop-v2.0.0) (2024-01-07)


### ⚠ BREAKING CHANGES

* `helia.pin.add` and `helia.pin.rm` now return `AsyncGenerator<CID>`
* The libp2p API has changed in a couple of places - please see the [upgrade guide](https://github.com/libp2p/js-libp2p/blob/main/doc/migrations/v0.46-v1.0.0.md)

### deps

* updates to libp2p v1 ([#320](https://github.com/ipfs/helia/issues/320)) ([635d7a2](https://github.com/ipfs/helia/commit/635d7a2938111ccc53f8defbd9b8f8f8ea3e8e6a))


### Features

* iterable pinning ([#231](https://github.com/ipfs/helia/issues/231)) ([c15c774](https://github.com/ipfs/helia/commit/c15c7749294d3d4aea5aef70544d088250336798))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/interface bumped from ^2.1.0 to ^3.0.0
    * helia bumped from ^2.1.0 to ^3.0.0

## [1.1.0](https://www.github.com/ipfs/helia/compare/interop-v1.0.3...interop-v1.1.0) (2023-11-06)


### Features

* GatewayBlockBroker prioritizes & tries all gateways ([#281](https://www.github.com/ipfs/helia/issues/281)) ([9bad21b](https://www.github.com/ipfs/helia/commit/9bad21bd59fe6d1ba4a137db5a46bd2ead5238c3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/interface bumped from ^2.0.0 to ^2.1.0
    * helia bumped from ^2.0.3 to ^2.1.0

### [1.0.3](https://www.github.com/ipfs/helia/compare/interop-v1.0.2...interop-v1.0.3) (2023-09-18)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * helia bumped from ^2.0.2 to ^2.0.3

### [1.0.2](https://www.github.com/ipfs/helia/compare/interop-v1.0.1...interop-v1.0.2) (2023-09-14)


### Bug Fixes

* **kubo:** ⬆️ Upgrading go-ipfs to kubo ([#251](https://www.github.com/ipfs/helia/issues/251)) ([963a7a2](https://www.github.com/ipfs/helia/commit/963a7a21774703a105c865a5b6db670f278eec73))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * helia bumped from ^2.0.1 to ^2.0.2

### [1.0.1](https://www.github.com/ipfs/helia/compare/interop-v1.0.0...interop-v1.0.1) (2023-08-16)


### Bug Fixes

* enable dcutr by default ([#239](https://www.github.com/ipfs/helia/issues/239)) ([7431f09](https://www.github.com/ipfs/helia/commit/7431f09aef332dc142a5f7c2c59c9410e4529a92))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * helia bumped from ^2.0.0 to ^2.0.1

## [1.0.0](https://www.github.com/ipfs/helia/compare/interop-v0.0.0...interop-v1.0.0) (2023-08-16)


### ⚠ BREAKING CHANGES

* libp2p has been updated to 0.46.x

### Dependencies

* **dev:** bump go-ipfs from 0.21.0 to 0.22.0 ([#228](https://www.github.com/ipfs/helia/issues/228)) ([2e8e447](https://www.github.com/ipfs/helia/commit/2e8e447f782745e517e935cd1bb3312db6384a5b))
* update libp2p to 0.46.x ([#215](https://www.github.com/ipfs/helia/issues/215)) ([65b68f0](https://www.github.com/ipfs/helia/commit/65b68f071d04d2f6f0fcf35938b146706b1a3cd0))



### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/interface bumped from ^1.0.0 to ^2.0.0
    * helia bumped from ^1.0.0 to ^2.0.0
