# Changelog

## [1.1.1](https://github.com/ipfs/helia/compare/bitswap-v1.1.0...bitswap-v1.1.1) (2024-05-20)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/utils bumped from ^0.3.0 to ^0.3.1

## [1.1.0](https://github.com/ipfs/helia/compare/bitswap-v1.0.1...bitswap-v1.1.0) (2024-05-01)


### Features

* add metrics property to helia interface ([#512](https://github.com/ipfs/helia/issues/512)) ([f7f71bb](https://github.com/ipfs/helia/commit/f7f71bb20ab0b4efbe802be5af1189e76153b826))


### Bug Fixes

* improve bitswap message merging ([#522](https://github.com/ipfs/helia/issues/522)) ([7419dfc](https://github.com/ipfs/helia/commit/7419dfc2fe273d3f816d27b62062636be0964d7a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0
    * @helia/utils bumped from ^0.2.0 to ^0.3.0

## [1.0.1](https://github.com/ipfs/helia/compare/bitswap-v1.0.0...bitswap-v1.0.1) (2024-04-22)


### Bug Fixes

* define max bitswap message sizes ([#510](https://github.com/ipfs/helia/issues/510)) ([58d7ddf](https://github.com/ipfs/helia/commit/58d7ddf19cd965a8a5cc1d8148fa073a6b44d8ae))
* split bitswap messages ([#507](https://github.com/ipfs/helia/issues/507)) ([59de059](https://github.com/ipfs/helia/commit/59de0599367c828998069ac37dc93e10ddb565a1))

## 1.0.0 (2024-04-15)


### Features

* add @helia/bitswap with sessions ([#409](https://github.com/ipfs/helia/issues/409)) ([e582c63](https://github.com/ipfs/helia/commit/e582c63ca296c789312f5fcf5e3e18f267f74c03))


### Bug Fixes

* improve sessions implementation ([#495](https://github.com/ipfs/helia/issues/495)) ([9ea934e](https://github.com/ipfs/helia/commit/9ea934ed7208e87c28bc65e9090bdedf66ceeffd))
* increase default listers on abort signals ([#484](https://github.com/ipfs/helia/issues/484)) ([7cd012a](https://github.com/ipfs/helia/commit/7cd012aa2ba568845d49d63a71806d20f6ac678f))
* remove wants from wantlist when multiple block retrievers are used ([#491](https://github.com/ipfs/helia/issues/491)) ([b1c761d](https://github.com/ipfs/helia/commit/b1c761db6db7a7aca3044263fdd5e8967204deeb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.2.0
    * @helia/utils bumped from ^0.1.0 to ^0.2.0
