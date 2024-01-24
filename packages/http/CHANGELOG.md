# Changelog

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
