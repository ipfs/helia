# Changelog

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
