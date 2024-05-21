# Changelog

## [3.0.1](https://github.com/ipfs/helia/compare/block-brokers-v3.0.0...block-brokers-v3.0.1) (2024-05-20)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/bitswap bumped from ^1.1.0 to ^1.1.1
    * @helia/utils bumped from ^0.3.0 to ^0.3.1

## [3.0.0](https://github.com/ipfs/helia/compare/block-brokers-v2.1.2...block-brokers-v3.0.0) (2024-05-02)


### ⚠ BREAKING CHANGES

* the gateways init option has been removed from trustless gateway block brokers

### Bug Fixes

* trustless gateway brokers no longer take a gateways arg ([#530](https://github.com/ipfs/helia/issues/530)) ([a8fdfc2](https://github.com/ipfs/helia/commit/a8fdfc27e3c2c75d75cc14dafe971796d70d8411))

## [2.1.2](https://github.com/ipfs/helia/compare/block-brokers-v2.1.1...block-brokers-v2.1.2) (2024-05-01)


### Bug Fixes

* http blockbroker loads gateways from routing ([#519](https://github.com/ipfs/helia/issues/519)) ([6a62d1c](https://github.com/ipfs/helia/commit/6a62d1c8dcfadead0498d0bb59958837dc204c91))
* use a short-lived AbortSignal for fetch operations ([#511](https://github.com/ipfs/helia/issues/511)) ([5e98950](https://github.com/ipfs/helia/commit/5e989501203c48661416aff090c135268b5c8445))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/bitswap bumped from ^1.0.1 to ^1.1.0
    * @helia/interface bumped from ^4.2.0 to ^4.3.0
    * @helia/utils bumped from ^0.2.0 to ^0.3.0

## [2.1.1](https://github.com/ipfs/helia/compare/block-brokers-v2.1.0...block-brokers-v2.1.1) (2024-04-22)


### Bug Fixes

* prevent duplicate trustless-gateway reqs ([#503](https://github.com/ipfs/helia/issues/503)) ([338885f](https://github.com/ipfs/helia/commit/338885f20277a25277ba9192d8e15cca95e640e4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/bitswap bumped from ^1.0.0 to ^1.0.1

## [2.1.0](https://github.com/ipfs/helia/compare/block-brokers-v2.0.3...block-brokers-v2.1.0) (2024-04-15)


### Features

* add @helia/bitswap with sessions ([#409](https://github.com/ipfs/helia/issues/409)) ([e582c63](https://github.com/ipfs/helia/commit/e582c63ca296c789312f5fcf5e3e18f267f74c03))
* add block session support to @helia/interface ([#398](https://github.com/ipfs/helia/issues/398)) ([5cf216b](https://github.com/ipfs/helia/commit/5cf216baa6806cd82f8fcddd1f024ef6a506f667))
* add sessions to trustless gateways ([#459](https://github.com/ipfs/helia/issues/459)) ([6ddefb0](https://github.com/ipfs/helia/commit/6ddefb01154b970f5ab7ec7cb7445d9eedbc5474))


### Bug Fixes

* improve sessions implementation ([#495](https://github.com/ipfs/helia/issues/495)) ([9ea934e](https://github.com/ipfs/helia/commit/9ea934ed7208e87c28bc65e9090bdedf66ceeffd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/bitswap bumped from ^0.0.0 to ^1.0.0
    * @helia/interface bumped from ^4.1.0 to ^4.2.0
    * @helia/utils bumped from ^0.1.0 to ^0.2.0

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
