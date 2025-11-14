# Changelog

## [2.2.5](https://github.com/ipfs/helia/compare/utils-v2.2.4...utils-v2.2.5) (2025-11-14)


### Bug Fixes

* allow truncated hashes ([#903](https://github.com/ipfs/helia/issues/903)) ([c3d41c1](https://github.com/ipfs/helia/commit/c3d41c1f9584c87fbebc88bc6f106e93b8444698))

## [2.2.4](https://github.com/ipfs/helia/compare/utils-v2.2.3...utils-v2.2.4) (2025-11-13)


### Bug Fixes

* allow routings to use helia components ([#900](https://github.com/ipfs/helia/issues/900)) ([cc90a4d](https://github.com/ipfs/helia/commit/cc90a4db91a44c0fedc2cb8a49da9b3349418815))

## [2.2.3](https://github.com/ipfs/helia/compare/utils-v2.2.2...utils-v2.2.3) (2025-10-29)


### Bug Fixes

* use libp2p provider routing field ([#889](https://github.com/ipfs/helia/issues/889)) ([d4d97b8](https://github.com/ipfs/helia/commit/d4d97b83f76be7e3b480052467408839f808e230))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^6.0.1 to ^6.0.2

## [2.2.2](https://github.com/ipfs/helia/compare/utils-v2.2.1...utils-v2.2.2) (2025-10-27)


### Bug Fixes

* add provider events to bitswap and trustless gateways ([#888](https://github.com/ipfs/helia/issues/888)) ([95d95da](https://github.com/ipfs/helia/commit/95d95dad7ff2a1e462b5a8a4f57ac40c4503f4ef))
* remove block request promise when initial provider search fails ([#886](https://github.com/ipfs/helia/issues/886)) ([bfc8710](https://github.com/ipfs/helia/commit/bfc871013eb2b4b1e9c62a0055002605eccb375b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^6.0.0 to ^6.0.1

## [2.2.1](https://github.com/ipfs/helia/compare/utils-v2.2.0...utils-v2.2.1) (2025-10-22)


### Bug Fixes

* update log formatting to print errors correctly ([#884](https://github.com/ipfs/helia/issues/884)) ([f35ecd1](https://github.com/ipfs/helia/commit/f35ecd1c8ad3c712d3882d0f0f2abaf0f0296ec1))

## [2.2.0](https://github.com/ipfs/helia/compare/utils-v2.1.1...utils-v2.2.0) (2025-10-20)


### Features

* allow filtering children ([#880](https://github.com/ipfs/helia/issues/880)) ([3eb6f3a](https://github.com/ipfs/helia/commit/3eb6f3a78f3dfe151ecc425290a06c92fa1431b7))


### Bug Fixes

* consolidate graph walkers ([#878](https://github.com/ipfs/helia/issues/878)) ([760ed27](https://github.com/ipfs/helia/commit/760ed27fea5e873e7b402773652961ab4583e2ac))

## [2.1.1](https://github.com/ipfs/helia/compare/utils-v2.1.0...utils-v2.1.1) (2025-10-17)


### Bug Fixes

* listen for signal abort during session creation ([#874](https://github.com/ipfs/helia/issues/874)) ([faac4ad](https://github.com/ipfs/helia/commit/faac4ad3650f7e6e53cba2195067efd4b8c7070a))

## [2.1.0](https://github.com/ipfs/helia/compare/utils-v2.0.1...utils-v2.1.0) (2025-10-17)


### Features

* add depth and breadth-first graph walkers to utils package ([#871](https://github.com/ipfs/helia/issues/871)) ([25eca46](https://github.com/ipfs/helia/commit/25eca4698b353e67fc7e5ea70ade3d247bd71a59))

## [2.0.1](https://github.com/ipfs/helia/compare/utils-v2.0.0...utils-v2.0.1) (2025-10-09)


### Bug Fixes

* enforce maximum identity hash size ([#865](https://github.com/ipfs/helia/issues/865)) ([d9051cd](https://github.com/ipfs/helia/commit/d9051cdc2fd19ab7def32d195b5798b27d85a078)), closes [#846](https://github.com/ipfs/helia/issues/846)

## [2.0.0](https://github.com/ipfs/helia/compare/utils-v1.4.0...utils-v2.0.0) (2025-10-09)


### ⚠ BREAKING CHANGES

* `ipns.publish` now accepts key name strings rather than private keys Names previously publishing using an user controlled private key, will need to be explicitly published again by first importing the key into the keychain (`await libp2p.keychain.importKey('my-key', key)` and then published with `ipns.publish('my-key', ...)`.
* uses libp2p v3 and updated block/data stores

### Features

* add ipns reproviding/republishing ([#764](https://github.com/ipfs/helia/issues/764)) ([008747b](https://github.com/ipfs/helia/commit/008747b59a03682e1b6f648a39635e1b1971e481))
* update to libp2p@v3 and latest data/block stores ([#856](https://github.com/ipfs/helia/issues/856)) ([34d3ecd](https://github.com/ipfs/helia/commit/34d3ecd76c8424387c57221000e226f08ccd1d1e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.4.0 to ^6.0.0

## [1.4.0](https://github.com/ipfs/helia/compare/utils-v1.3.2...utils-v1.4.0) (2025-07-22)


### Features

* add libp2p to @helia/http ([#826](https://github.com/ipfs/helia/issues/826)) ([235e5c4](https://github.com/ipfs/helia/commit/235e5c4093a51bda1e0331f9dd26754f601b582c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.3.2 to ^5.4.0

## [1.3.2](https://github.com/ipfs/helia/compare/utils-v1.3.1...utils-v1.3.2) (2025-05-20)


### Dependencies

* update aegir to 47.x.x ([#804](https://github.com/ipfs/helia/issues/804)) ([60fbbc2](https://github.com/ipfs/helia/commit/60fbbc2eb08e023e2eac02ae0e89ed143d715084))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.3.1 to ^5.3.2

## [1.3.1](https://github.com/ipfs/helia/compare/utils-v1.3.0...utils-v1.3.1) (2025-05-13)


### Dependencies

* update all deps ([#792](https://github.com/ipfs/helia/issues/792)) ([d43efc7](https://github.com/ipfs/helia/commit/d43efc7bdfff34071a8e4e22e01f659fbac0b78e))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.3.0 to ^5.3.1

## [1.3.0](https://github.com/ipfs/helia/compare/utils-v1.2.2...utils-v1.3.0) (2025-05-13)


### Features

* pass initial providers to session ([#777](https://github.com/ipfs/helia/issues/777)) ([3d77369](https://github.com/ipfs/helia/commit/3d773698389deb70e1a0181eb81fb8b5992857b8))


### Bug Fixes

* reject blockstore session get promise when signal fires  ([#776](https://github.com/ipfs/helia/issues/776)) ([d883eaf](https://github.com/ipfs/helia/commit/d883eafbdcd981a0cc7c78cf361bb72324a8cbdc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.2.1 to ^5.3.0

## [1.2.2](https://github.com/ipfs/helia/compare/utils-v1.2.1...utils-v1.2.2) (2025-03-13)


### Documentation

* add spell checker to ci ([#743](https://github.com/ipfs/helia/issues/743)) ([45ca6bc](https://github.com/ipfs/helia/commit/45ca6bc70b1644028500101044595fa0e2199b07))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.2.0 to ^5.2.1

## [1.2.1](https://github.com/ipfs/helia/compare/utils-v1.2.0...utils-v1.2.1) (2025-02-10)


### Bug Fixes

* update libp2p deps, send user agent with auto-tls ([#736](https://github.com/ipfs/helia/issues/736)) ([c015793](https://github.com/ipfs/helia/commit/c01579393ddd622352d0d0179c67adaf5ccc4c8f))

## [1.2.0](https://github.com/ipfs/helia/compare/utils-v1.1.0...utils-v1.2.0) (2025-01-14)


### Features

* add method tracing to routing ([#715](https://github.com/ipfs/helia/issues/715)) ([5784ceb](https://github.com/ipfs/helia/commit/5784cebb3225157d6220668d4f58481f046debf2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.1.0 to ^5.2.0

## [1.1.0](https://github.com/ipfs/helia/compare/utils-v1.0.1...utils-v1.1.0) (2024-11-18)


### Features

* add cancelReprovide function to routing ([#672](https://github.com/ipfs/helia/issues/672)) ([dc13525](https://github.com/ipfs/helia/commit/dc1352563ab5ed7b204ae702c1e48035d196a470))


### Dependencies

* bump aegir from 44.1.4 to 45.0.1 ([#669](https://github.com/ipfs/helia/issues/669)) ([e58e49c](https://github.com/ipfs/helia/commit/e58e49c6aed8ea9d1e9851435a25e33fdbee3781))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.0.0 to ^5.1.0

## [1.0.1](https://github.com/ipfs/helia/compare/utils-v1.0.0...utils-v1.0.1) (2024-10-23)


### Bug Fixes

* remove redundant filter ([#663](https://github.com/ipfs/helia/issues/663)) ([efc47fa](https://github.com/ipfs/helia/commit/efc47fa081107d31a8985ed72b36a244385b55ca))

## [1.0.0](https://github.com/ipfs/helia/compare/utils-v0.3.3...utils-v1.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* the `.dagWalkers` property has been removed
* helia now uses libp2p@2.x.x

### Features

* allow updating pin metadata ([#647](https://github.com/ipfs/helia/issues/647)) ([bc64f47](https://github.com/ipfs/helia/commit/bc64f47897691295435568beee61383116b0032b))


### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* replace dag walkers with generic CID extraction from blocks ([#447](https://github.com/ipfs/helia/issues/447)) ([5ff6998](https://github.com/ipfs/helia/commit/5ff6998e6bc8b04e3407bc98c1924c55f632d9b7))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))
* use hasCode from multiformats ([#635](https://github.com/ipfs/helia/issues/635)) ([f5a03fc](https://github.com/ipfs/helia/commit/f5a03fc28d0cd59841b842306f912c092aeabd5f))


### Dependencies

* **dev:** bump sinon from 18.0.1 to 19.0.2 ([#634](https://github.com/ipfs/helia/issues/634)) ([23e62e1](https://github.com/ipfs/helia/commit/23e62e16b8962bfe982a1bbb157a144382ca7099))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0

## [0.3.3](https://github.com/ipfs/helia/compare/utils-v0.3.2...utils-v0.3.3) (2024-07-31)


### Bug Fixes

* update deps and fix types ([#572](https://github.com/ipfs/helia/issues/572)) ([f16c9ea](https://github.com/ipfs/helia/commit/f16c9eac32677333313c433eb918b705439c0819))


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* **dev:** bump sinon from 17.0.2 to 18.0.0 ([#536](https://github.com/ipfs/helia/issues/536)) ([62f77df](https://github.com/ipfs/helia/commit/62f77dfbff94a64e9c248f5be54055c18a6427f7))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

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
