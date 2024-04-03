# Changelog

## [2.0.3](https://github.com/ipfs/helia/compare/block-brokers-v2.0.2...block-brokers-v2.0.3) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [2.0.2](https://github.com/ipfs/helia/compare/block-brokers-v2.0.1...block-brokers-v2.0.2) (2024-02-28)


### Bug Fixes

* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [2.0.1](https://github.com/ipfs/helia/compare/block-brokers-v2.0.0...block-brokers-v2.0.1) (2024-01-31)


### Bug Fixes

* @helia/block-brokers gateways uses path gateways ([#374](https://github.com/ipfs/helia/issues/374)) ([94b0cd1](https://github.com/ipfs/helia/commit/94b0cd162ce864d44726a1d486389b0a1fdd3efc))

## [2.0.0](https://github.com/ipfs/helia/compare/block-brokers-v1.0.0...block-brokers-v2.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))
* expose configured dag walkers and hashers on helia interface ([#381](https://github.com/ipfs/helia/issues/381)) ([843fba4](https://github.com/ipfs/helia/commit/843fba467ebb032907c888da499147a5349ec10e)), closes [#375](https://github.com/ipfs/helia/issues/375)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## 1.0.0 (2024-01-09)


### Bug Fixes

* create @helia/block-brokers package ([#341](https://github.com/ipfs/helia/issues/341)) ([#342](https://github.com/ipfs/helia/issues/342)) ([2979147](https://github.com/ipfs/helia/commit/297914756fa06dc0c28890a2654d1159d16689c2))
* remove w3s.link default block-broker ([#371](https://github.com/ipfs/helia/issues/371)) ([5c4fd54](https://github.com/ipfs/helia/commit/5c4fd54207384165c4e6309ec7663e996d7d66d4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1
