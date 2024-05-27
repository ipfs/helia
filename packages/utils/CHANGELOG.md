# Changelog

## [0.3.2](https://github.com/ipfs/helia/compare/utils-v0.3.1...utils-v0.3.2) (2024-05-27)


### Bug Fixes

* add missing log prefix colon for helia:session-storage ([#544](https://github.com/ipfs/helia/issues/544)) ([011fa92](https://github.com/ipfs/helia/commit/011fa92c05bf42fb20666b1df4c86fb47889a07e))

## [0.3.1](https://github.com/ipfs/helia/compare/utils-v0.3.0...utils-v0.3.1) (2024-05-20)


### Bug Fixes

* check eviction filter for new providers ([#542](https://github.com/ipfs/helia/issues/542)) ([f46700f](https://github.com/ipfs/helia/commit/f46700fd871d5419e75ecfb0b00fb01aedbe84c7)), closes [#501](https://github.com/ipfs/helia/issues/501)
* type error ([#537](https://github.com/ipfs/helia/issues/537)) ([e6b976a](https://github.com/ipfs/helia/commit/e6b976a4df96b27bf3aa239356d2e991801da28c))

## [0.3.0](https://github.com/ipfs/helia/compare/utils-v0.2.0...utils-v0.3.0) (2024-05-01)


### Features

* add metrics property to helia interface ([#512](https://github.com/ipfs/helia/issues/512)) ([f7f71bb](https://github.com/ipfs/helia/commit/f7f71bb20ab0b4efbe802be5af1189e76153b826))


### Bug Fixes

* do not append peer ids to provider multiaddrs ([#516](https://github.com/ipfs/helia/issues/516)) ([e4e67d0](https://github.com/ipfs/helia/commit/e4e67d0cc64593eca8c3eaa67a4e27544a1692ee))
* log peer id as string not object ([#514](https://github.com/ipfs/helia/issues/514)) ([f6bcbd4](https://github.com/ipfs/helia/commit/f6bcbd4e784a0c7a230f8c5ccb7889850d692af4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [0.2.0](https://github.com/ipfs/helia/compare/utils-v0.1.0...utils-v0.2.0) (2024-04-15)


### Features

* add block session support to @helia/interface ([#398](https://github.com/ipfs/helia/issues/398)) ([5cf216b](https://github.com/ipfs/helia/commit/5cf216baa6806cd82f8fcddd1f024ef6a506f667))


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))
* blockstore operations should throw when passed an aborted signal ([#497](https://github.com/ipfs/helia/issues/497)) ([9a10498](https://github.com/ipfs/helia/commit/9a10498e55b4380191135535f7f607082e9c00c6))
* cancel in-flight block requests when racing brokers ([#490](https://github.com/ipfs/helia/issues/490)) ([395cd9e](https://github.com/ipfs/helia/commit/395cd9e6ac2f829ef47b503cc7a6c77922f484cf))
* improve sessions implementation ([#495](https://github.com/ipfs/helia/issues/495)) ([9ea934e](https://github.com/ipfs/helia/commit/9ea934ed7208e87c28bc65e9090bdedf66ceeffd))
* increase default listers on abort signals ([#484](https://github.com/ipfs/helia/issues/484)) ([7cd012a](https://github.com/ipfs/helia/commit/7cd012aa2ba568845d49d63a71806d20f6ac678f))
* wrap blockstore in identity blockstore ([#493](https://github.com/ipfs/helia/issues/493)) ([b67ac5f](https://github.com/ipfs/helia/commit/b67ac5f16eca1df5534c985045250bdb334a85cf))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [0.1.0](https://github.com/ipfs/helia/compare/utils-v0.0.2...utils-v0.1.0) (2024-03-14)


### Features

* expose .dns property on @helia/interface ([#465](https://github.com/ipfs/helia/issues/465)) ([8c9bb7d](https://github.com/ipfs/helia/commit/8c9bb7d224a1b786cba1fba18bffe07001a3b95d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [0.0.2](https://github.com/ipfs/helia/compare/utils-v0.0.1...utils-v0.0.2) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## 0.0.1 (2024-01-24)

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0
