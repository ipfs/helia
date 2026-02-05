## [4.1.0](https://github.com/ipfs/helia/compare/interface-v4.0.1...interface-v4.1.0) (2024-03-14)


### Features

* expose .dns property on @helia/interface ([#465](https://github.com/ipfs/helia/issues/465)) ([8c9bb7d](https://github.com/ipfs/helia/commit/8c9bb7d224a1b786cba1fba18bffe07001a3b95d))

## [6.1.1](https://github.com/ipfs/helia/compare/interface-v6.1.0...interface-v6.1.1) (2026-02-05)


### Bug Fixes

* allow configuring cid peer filter size ([#955](https://github.com/ipfs/helia/issues/955)) ([e16b7a7](https://github.com/ipfs/helia/commit/e16b7a7dcd013f13321dea162eee0130473541ea))

## [6.1.0](https://github.com/ipfs/helia/compare/interface-v6.0.3...interface-v6.1.0) (2026-02-04)


### Features

* allow adding peers to session ([#950](https://github.com/ipfs/helia/issues/950)) ([33e4681](https://github.com/ipfs/helia/commit/33e4681394539d4298a028d2d9ff48a14f76a8e3))


### Bug Fixes

* add name to block brokers ([#949](https://github.com/ipfs/helia/issues/949)) ([0456c42](https://github.com/ipfs/helia/commit/0456c42dbd92d94633c133d4f5fe35264a6bbb80))

## [6.0.3](https://github.com/ipfs/helia/compare/interface-v6.0.2...interface-v6.0.3) (2026-02-02)


### Bug Fixes

* ensure offline can be passed to create session ([#946](https://github.com/ipfs/helia/issues/946)) ([6f4c25f](https://github.com/ipfs/helia/commit/6f4c25f65e82942c3788304b26b6ab0a4de95110))

## [6.0.2](https://github.com/ipfs/helia/compare/interface-v6.0.1...interface-v6.0.2) (2025-10-29)


### Bug Fixes

* use libp2p provider routing field ([#889](https://github.com/ipfs/helia/issues/889)) ([d4d97b8](https://github.com/ipfs/helia/commit/d4d97b83f76be7e3b480052467408839f808e230))

## [6.0.1](https://github.com/ipfs/helia/compare/interface-v6.0.0...interface-v6.0.1) (2025-10-27)


### Bug Fixes

* add provider events to bitswap and trustless gateways ([#888](https://github.com/ipfs/helia/issues/888)) ([95d95da](https://github.com/ipfs/helia/commit/95d95dad7ff2a1e462b5a8a4f57ac40c4503f4ef))

## [6.0.0](https://github.com/ipfs/helia/compare/interface-v5.4.0...interface-v6.0.0) (2025-10-09)


### ⚠ BREAKING CHANGES

* `ipns.publish` now accepts key name strings rather than private keys Names previously publishing using an user controlled private key, will need to be explicitly published again by first importing the key into the keychain (`await libp2p.keychain.importKey('my-key', key)` and then published with `ipns.publish('my-key', ...)`.
* uses libp2p v3 and updated block/data stores

### Features

* add ipns reproviding/republishing ([#764](https://github.com/ipfs/helia/issues/764)) ([008747b](https://github.com/ipfs/helia/commit/008747b59a03682e1b6f648a39635e1b1971e481))
* update to libp2p@v3 and latest data/block stores ([#856](https://github.com/ipfs/helia/issues/856)) ([34d3ecd](https://github.com/ipfs/helia/commit/34d3ecd76c8424387c57221000e226f08ccd1d1e))


### Bug Fixes

* @helia/* modules validate CID codec ([#643](https://github.com/ipfs/helia/issues/643)) ([93aa464](https://github.com/ipfs/helia/commit/93aa46459dcff81f0e5eef479f76e39ef5f03736))

## [5.4.0](https://github.com/ipfs/helia/compare/interface-v5.3.2...interface-v5.4.0) (2025-07-22)


### Features

* add libp2p to @helia/http ([#826](https://github.com/ipfs/helia/issues/826)) ([235e5c4](https://github.com/ipfs/helia/commit/235e5c4093a51bda1e0331f9dd26754f601b582c))


### Bug Fixes

* trustless gateway returned blocks can be limited ([#791](https://github.com/ipfs/helia/issues/791)) ([7a52e95](https://github.com/ipfs/helia/commit/7a52e95165f4a16a1fb2f62cfc6e936cb6f78b69))

## [5.3.2](https://github.com/ipfs/helia/compare/interface-v5.3.1...interface-v5.3.2) (2025-05-20)


### Dependencies

* update aegir to 47.x.x ([#804](https://github.com/ipfs/helia/issues/804)) ([60fbbc2](https://github.com/ipfs/helia/commit/60fbbc2eb08e023e2eac02ae0e89ed143d715084))

## [5.3.1](https://github.com/ipfs/helia/compare/interface-v5.3.0...interface-v5.3.1) (2025-05-13)


### Dependencies

* update all deps ([#792](https://github.com/ipfs/helia/issues/792)) ([d43efc7](https://github.com/ipfs/helia/commit/d43efc7bdfff34071a8e4e22e01f659fbac0b78e))

## [5.3.0](https://github.com/ipfs/helia/compare/interface-v5.2.1...interface-v5.3.0) (2025-05-13)


### Features

* pass initial providers to session ([#777](https://github.com/ipfs/helia/issues/777)) ([3d77369](https://github.com/ipfs/helia/commit/3d773698389deb70e1a0181eb81fb8b5992857b8))

## [5.2.1](https://github.com/ipfs/helia/compare/interface-v5.2.0...interface-v5.2.1) (2025-03-13)


### Documentation

* add spell checker to ci ([#743](https://github.com/ipfs/helia/issues/743)) ([45ca6bc](https://github.com/ipfs/helia/commit/45ca6bc70b1644028500101044595fa0e2199b07))

## [5.2.0](https://github.com/ipfs/helia/compare/interface-v5.1.0...interface-v5.2.0) (2025-01-14)


### Features

* add method tracing to routing ([#715](https://github.com/ipfs/helia/issues/715)) ([5784ceb](https://github.com/ipfs/helia/commit/5784cebb3225157d6220668d4f58481f046debf2))

## [5.1.0](https://github.com/ipfs/helia/compare/interface-v5.0.0...interface-v5.1.0) (2024-11-18)


### Features

* add cancelReprovide function to routing ([#672](https://github.com/ipfs/helia/issues/672)) ([dc13525](https://github.com/ipfs/helia/commit/dc1352563ab5ed7b204ae702c1e48035d196a470))


### Dependencies

* bump aegir from 44.1.4 to 45.0.1 ([#669](https://github.com/ipfs/helia/issues/669)) ([e58e49c](https://github.com/ipfs/helia/commit/e58e49c6aed8ea9d1e9851435a25e33fdbee3781))

## [5.0.0](https://github.com/ipfs/helia/compare/interface-v4.3.1...interface-v5.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* the metadata record value field has changed from `any` to `string | number | boolean`
* the `.dagWalkers` property has been removed
* helia now uses libp2p@2.x.x

### Features

* allow updating pin metadata ([#647](https://github.com/ipfs/helia/issues/647)) ([bc64f47](https://github.com/ipfs/helia/commit/bc64f47897691295435568beee61383116b0032b))


### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* define string metadata type ([#641](https://github.com/ipfs/helia/issues/641)) ([c04dbf5](https://github.com/ipfs/helia/commit/c04dbf5f6bf5ef37ba9fc854c0c3080f37d5c7c3))
* replace dag walkers with generic CID extraction from blocks ([#447](https://github.com/ipfs/helia/issues/447)) ([5ff6998](https://github.com/ipfs/helia/commit/5ff6998e6bc8b04e3407bc98c1924c55f632d9b7))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))

## [4.3.1](https://github.com/ipfs/helia/compare/interface-v4.3.0...interface-v4.3.1) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))

## [4.3.0](https://github.com/ipfs/helia/compare/interface-v4.2.0...interface-v4.3.0) (2024-05-01)


### Features

* add metrics property to helia interface ([#512](https://github.com/ipfs/helia/issues/512)) ([f7f71bb](https://github.com/ipfs/helia/commit/f7f71bb20ab0b4efbe802be5af1189e76153b826))

## [4.2.0](https://github.com/ipfs/helia/compare/interface-v4.1.0...interface-v4.2.0) (2024-04-15)


### Features

* add block session support to @helia/interface ([#398](https://github.com/ipfs/helia/issues/398)) ([5cf216b](https://github.com/ipfs/helia/commit/5cf216baa6806cd82f8fcddd1f024ef6a506f667))


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))
* improve sessions implementation ([#495](https://github.com/ipfs/helia/issues/495)) ([9ea934e](https://github.com/ipfs/helia/commit/9ea934ed7208e87c28bc65e9090bdedf66ceeffd))

## [4.0.1](https://github.com/ipfs/helia/compare/interface-v4.0.0...interface-v4.0.1) (2024-02-28)


### Bug Fixes

* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))

## [4.0.0](https://github.com/ipfs/helia/compare/interface-v3.0.1...interface-v4.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))
* expose configured dag walkers and hashers on helia interface ([#381](https://github.com/ipfs/helia/issues/381)) ([843fba4](https://github.com/ipfs/helia/commit/843fba467ebb032907c888da499147a5349ec10e)), closes [#375](https://github.com/ipfs/helia/issues/375)


### Bug Fixes

* update ipns module to v9 and fix double verification of records ([#396](https://github.com/ipfs/helia/issues/396)) ([f2853f8](https://github.com/ipfs/helia/commit/f2853f8bd5bdcee8ab7a685355b0be47f29620e0))

## [3.0.1](https://github.com/ipfs/helia/compare/interface-v3.0.0...interface-v3.0.1) (2024-01-09)


### Bug Fixes

* create @helia/block-brokers package ([#341](https://github.com/ipfs/helia/issues/341)) ([#342](https://github.com/ipfs/helia/issues/342)) ([2979147](https://github.com/ipfs/helia/commit/297914756fa06dc0c28890a2654d1159d16689c2))

## [3.0.0](https://github.com/ipfs/helia/compare/interface-v2.1.0...interface-v3.0.0) (2024-01-07)


### ⚠ BREAKING CHANGES

* `helia.pin.add` and `helia.pin.rm` now return `AsyncGenerator<CID>`
* The libp2p API has changed in a couple of places - please see the [upgrade guide](https://github.com/libp2p/js-libp2p/blob/main/doc/migrations/v0.46-v1.0.0.md)

### deps

* updates to libp2p v1 ([#320](https://github.com/ipfs/helia/issues/320)) ([635d7a2](https://github.com/ipfs/helia/commit/635d7a2938111ccc53f8defbd9b8f8f8ea3e8e6a))


### Features

* iterable pinning ([#231](https://github.com/ipfs/helia/issues/231)) ([c15c774](https://github.com/ipfs/helia/commit/c15c7749294d3d4aea5aef70544d088250336798))

## [2.1.0](https://www.github.com/ipfs/helia/compare/interface-v2.0.0...interface-v2.1.0) (2023-11-06)


### Features

* configurable block brokers ([#280](https://www.github.com/ipfs/helia/issues/280)) ([0749cbf](https://www.github.com/ipfs/helia/commit/0749cbf99745ea6ab4363f1b5d635634ca0ddcfa))
* GatewayBlockBroker prioritizes & tries all gateways ([#281](https://www.github.com/ipfs/helia/issues/281)) ([9bad21b](https://www.github.com/ipfs/helia/commit/9bad21bd59fe6d1ba4a137db5a46bd2ead5238c3))

## [2.0.0](https://www.github.com/ipfs/helia/compare/interface-v1.2.2...interface-v2.0.0) (2023-08-16)


### ⚠ BREAKING CHANGES

* libp2p has been updated to 0.46.x

### Dependencies

* update libp2p to 0.46.x ([#215](https://www.github.com/ipfs/helia/issues/215)) ([65b68f0](https://www.github.com/ipfs/helia/commit/65b68f071d04d2f6f0fcf35938b146706b1a3cd0))

## [1.2.2](https://github.com/ipfs/helia/compare/interface-v1.2.1..interface-v1.2.2) (2023-08-05)


### Trivial Changes

* update project config ([#175](https://github.com/ipfs/helia/issues/175)) ([f185a72](https://github.com/ipfs/helia/commit/f185a7220a62f7fc0c025aa5c0be5a981c63cc48))


### Dependencies

* **dev:** bump aegir from 39.0.13 to 40.0.8 ([#198](https://github.com/ipfs/helia/issues/198)) ([4d75ecf](https://github.com/ipfs/helia/commit/4d75ecffb79e5177da35d3106e42dac7bc63153a))

## [1.2.1](https://github.com/ipfs/helia/compare/interface-v1.2.0..interface-v1.2.1) (2023-06-07)


### Bug Fixes

* pass options to blockstore.get during pin.add ([#148](https://github.com/ipfs/helia/issues/148)) ([3a5234e](https://github.com/ipfs/helia/commit/3a5234e3c2f88f9910678b0cbbac5fd340117cc9))

## [1.2.0](https://github.com/ipfs/helia/compare/interface-v1.1.1..interface-v1.2.0) (2023-06-07)


### Features

* add offline option to blockstore get ([#145](https://github.com/ipfs/helia/issues/145)) ([71c5f6b](https://github.com/ipfs/helia/commit/71c5f6bc32b324ee237e56c2c5a1ce903b3bdbef))


### Trivial Changes

* update changelogs ([#142](https://github.com/ipfs/helia/issues/142)) ([fefd374](https://github.com/ipfs/helia/commit/fefd3744c0a6d8471de31762ece6ec59b65496c1))

## [1.1.1](https://github.com/ipfs/helia/compare/interface-v1.1.0..interface-v1.1.1) (2023-05-19)


### Bug Fixes

* add helia version to agent version ([#128](https://github.com/ipfs/helia/issues/128)) ([48e19ec](https://github.com/ipfs/helia/commit/48e19ec545cc67157e14ae59054fa377a583cb01)), closes [#122](https://github.com/ipfs/helia/issues/122)

## [1.1.0](https://github.com/ipfs/helia/compare/interface-v1.0.0..interface-v1.1.0) (2023-05-19)


### Features

* provide default libp2p instance ([#127](https://github.com/ipfs/helia/issues/127)) ([45c9d89](https://github.com/ipfs/helia/commit/45c9d896afa27f5ea043cc5f576d50fc4fa556e9)), closes [#121](https://github.com/ipfs/helia/issues/121)


### Trivial Changes

* bump aegir from 38.1.8 to 39.0.4 ([#111](https://github.com/ipfs/helia/issues/111)) ([2156568](https://github.com/ipfs/helia/commit/215656870cb821dd6be2f8054dc39932ba25af14))

## @helia/interface-v1.0.0 (2023-03-23)


### Features

* add bitswap progress events ([#50](https://github.com/ipfs/helia/issues/50)) ([7460719](https://github.com/ipfs/helia/commit/7460719be44b4ff9bad629654efa29c56242e03a)), closes [#27](https://github.com/ipfs/helia/issues/27)
* add pinning API ([#36](https://github.com/ipfs/helia/issues/36)) ([270bb98](https://github.com/ipfs/helia/commit/270bb988eb8aefc8afe68e3580c3ef18960b3188)), closes [#28](https://github.com/ipfs/helia/issues/28) [/github.com/ipfs/helia/pull/36#issuecomment-1441403221](https://github.com/ipfs//github.com/ipfs/helia/pull/36/issues/issuecomment-1441403221) [#28](https://github.com/ipfs/helia/issues/28)
* initial implementation ([#17](https://github.com/ipfs/helia/issues/17)) ([343d360](https://github.com/ipfs/helia/commit/343d36016b164ed45cec4eb670d7f74860166ce4))


### Bug Fixes

* extend blockstore interface ([#55](https://github.com/ipfs/helia/issues/55)) ([42308c0](https://github.com/ipfs/helia/commit/42308c0d75e81789d909470ded90ad81ee0f84c7))
* make all helia args optional ([#37](https://github.com/ipfs/helia/issues/37)) ([d15d76c](https://github.com/ipfs/helia/commit/d15d76cdc40a31bd1e47ca09583cc685583243b9))
* survive a cid causing an error during gc ([#38](https://github.com/ipfs/helia/issues/38)) ([5330188](https://github.com/ipfs/helia/commit/53301881dc6226ea3fc6823fd6e298e4d4796408))
* update block events ([#58](https://github.com/ipfs/helia/issues/58)) ([d33be53](https://github.com/ipfs/helia/commit/d33be534972a4c238fc6d43c4284c6bd834ae218))
* update blocks interface to align with interface-blockstore ([#54](https://github.com/ipfs/helia/issues/54)) ([202b966](https://github.com/ipfs/helia/commit/202b966df3866d449751f775ed3edc9c92e32f6a))


### Dependencies

* update interface-store to 5.x.x ([#63](https://github.com/ipfs/helia/issues/63)) ([5bf11d6](https://github.com/ipfs/helia/commit/5bf11d638eee423624ac49af97757d730744f384))


### Trivial Changes

* add release config ([a1c7ed0](https://github.com/ipfs/helia/commit/a1c7ed0560aaab032b641a78c9a76fc05a691a10))
* fix ci badge ([50929c0](https://github.com/ipfs/helia/commit/50929c01a38317f2f580609cc1b9c4c5485f32c8))
* release main ([#62](https://github.com/ipfs/helia/issues/62)) ([2bce77c](https://github.com/ipfs/helia/commit/2bce77c7d68735efca6ba602c215f432ba9b722d))
* update logo ([654a70c](https://github.com/ipfs/helia/commit/654a70cff9c222e4029ddd183d609514afc852ed))
* update publish config ([913ab6a](https://github.com/ipfs/helia/commit/913ab6ae9a2970c4b908de04b8b6a236b931a3b0))
* update release please config ([b52d5e3](https://github.com/ipfs/helia/commit/b52d5e3eecce41b10640426c339c99ad14ce874e))

## @helia/interface-v0.1.0 (2023-03-22)


### Features

* add bitswap progress events ([#50](https://www.github.com/ipfs/helia/issues/50)) ([7460719](https://www.github.com/ipfs/helia/commit/7460719be44b4ff9bad629654efa29c56242e03a)), closes [#27](https://www.github.com/ipfs/helia/issues/27)
* add pinning API ([#36](https://www.github.com/ipfs/helia/issues/36)) ([270bb98](https://www.github.com/ipfs/helia/commit/270bb988eb8aefc8afe68e3580c3ef18960b3188)), closes [#28](https://www.github.com/ipfs/helia/issues/28)
* initial implementation ([#17](https://www.github.com/ipfs/helia/issues/17)) ([343d360](https://www.github.com/ipfs/helia/commit/343d36016b164ed45cec4eb670d7f74860166ce4))


### Bug Fixes

* extend blockstore interface ([#55](https://www.github.com/ipfs/helia/issues/55)) ([42308c0](https://www.github.com/ipfs/helia/commit/42308c0d75e81789d909470ded90ad81ee0f84c7))
* make all helia args optional ([#37](https://www.github.com/ipfs/helia/issues/37)) ([d15d76c](https://www.github.com/ipfs/helia/commit/d15d76cdc40a31bd1e47ca09583cc685583243b9))
* survive a cid causing an error during gc ([#38](https://www.github.com/ipfs/helia/issues/38)) ([5330188](https://www.github.com/ipfs/helia/commit/53301881dc6226ea3fc6823fd6e298e4d4796408))
* update block events ([#58](https://www.github.com/ipfs/helia/issues/58)) ([d33be53](https://www.github.com/ipfs/helia/commit/d33be534972a4c238fc6d43c4284c6bd834ae218))
* update blocks interface to align with interface-blockstore ([#54](https://www.github.com/ipfs/helia/issues/54)) ([202b966](https://www.github.com/ipfs/helia/commit/202b966df3866d449751f775ed3edc9c92e32f6a))
