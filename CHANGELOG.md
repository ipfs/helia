# Changelog

## 1.0.0 (2024-01-08)


### ⚠ BREAKING CHANGES

* `helia.pin.add` and `helia.pin.rm` now return `AsyncGenerator<CID>`
* The libp2p API has changed in a couple of places - please see the [upgrade guide](https://github.com/libp2p/js-libp2p/blob/main/doc/migrations/v0.46-v1.0.0.md)
* libp2p has been updated to 0.46.x

### deps

* update libp2p to 0.46.x ([#215](https://github.com/ipfs/helia/issues/215)) ([65b68f0](https://github.com/ipfs/helia/commit/65b68f071d04d2f6f0fcf35938b146706b1a3cd0))
* updates to libp2p v1 ([#320](https://github.com/ipfs/helia/issues/320)) ([635d7a2](https://github.com/ipfs/helia/commit/635d7a2938111ccc53f8defbd9b8f8f8ea3e8e6a))


### Features

* add bitswap progress events ([#50](https://github.com/ipfs/helia/issues/50)) ([7460719](https://github.com/ipfs/helia/commit/7460719be44b4ff9bad629654efa29c56242e03a)), closes [#27](https://github.com/ipfs/helia/issues/27)
* add offline option to blockstore get ([#145](https://github.com/ipfs/helia/issues/145)) ([71c5f6b](https://github.com/ipfs/helia/commit/71c5f6bc32b324ee237e56c2c5a1ce903b3bdbef))
* add pinning API ([#36](https://github.com/ipfs/helia/issues/36)) ([270bb98](https://github.com/ipfs/helia/commit/270bb988eb8aefc8afe68e3580c3ef18960b3188)), closes [#28](https://github.com/ipfs/helia/issues/28)
* allow passing partial libp2p config to helia factory ([#140](https://github.com/ipfs/helia/issues/140)) ([33a75d5](https://github.com/ipfs/helia/commit/33a75d5f80e2f211440c087806f463525de910d9))
* configurable block brokers ([#280](https://github.com/ipfs/helia/issues/280)) ([0749cbf](https://github.com/ipfs/helia/commit/0749cbf99745ea6ab4363f1b5d635634ca0ddcfa))
* GatewayBlockBroker prioritizes & tries all gateways ([#281](https://github.com/ipfs/helia/issues/281)) ([9bad21b](https://github.com/ipfs/helia/commit/9bad21bd59fe6d1ba4a137db5a46bd2ead5238c3))
* initial implementation ([#17](https://github.com/ipfs/helia/issues/17)) ([343d360](https://github.com/ipfs/helia/commit/343d36016b164ed45cec4eb670d7f74860166ce4))
* iterable pinning ([#231](https://github.com/ipfs/helia/issues/231)) ([c15c774](https://github.com/ipfs/helia/commit/c15c7749294d3d4aea5aef70544d088250336798))
* provide default libp2p instance ([#127](https://github.com/ipfs/helia/issues/127)) ([45c9d89](https://github.com/ipfs/helia/commit/45c9d896afa27f5ea043cc5f576d50fc4fa556e9)), closes [#121](https://github.com/ipfs/helia/issues/121)
* re-export types from @helia/interface ([#232](https://github.com/ipfs/helia/issues/232)) ([09c1e47](https://github.com/ipfs/helia/commit/09c1e4787a506d34a00d9ce7852d73471d47db1b))
* use trustless-gateway.link by default ([#299](https://github.com/ipfs/helia/issues/299)) ([bf11efa](https://github.com/ipfs/helia/commit/bf11efa4875f3b8f844511d70122983fc46b4f88))


### Bug Fixes

* add dag walker for json codec ([#247](https://github.com/ipfs/helia/issues/247)) ([5c4b570](https://github.com/ipfs/helia/commit/5c4b5709e6b98de5efc9bed388942e367f5874e7)), closes [#246](https://github.com/ipfs/helia/issues/246)
* add dht validators/selectors for ipns ([#135](https://github.com/ipfs/helia/issues/135)) ([2c8e6b5](https://github.com/ipfs/helia/commit/2c8e6b51b3c401a0472a024b8dac3d3ba735d74c))
* add helia version to agent version ([#128](https://github.com/ipfs/helia/issues/128)) ([48e19ec](https://github.com/ipfs/helia/commit/48e19ec545cc67157e14ae59054fa377a583cb01)), closes [#122](https://github.com/ipfs/helia/issues/122)
* create @helia/block-brokers package ([#341](https://github.com/ipfs/helia/issues/341)) ([#342](https://github.com/ipfs/helia/issues/342)) ([2979147](https://github.com/ipfs/helia/commit/297914756fa06dc0c28890a2654d1159d16689c2))
* dedupe bootstrap list ([#129](https://github.com/ipfs/helia/issues/129)) ([bb5d1e9](https://github.com/ipfs/helia/commit/bb5d1e91daae9f6c399e0fdf974318a4a7353fb9))
* enable dcutr by default ([#239](https://github.com/ipfs/helia/issues/239)) ([7431f09](https://github.com/ipfs/helia/commit/7431f09aef332dc142a5f7c2c59c9410e4529a92))
* ensure pinned blocks are present ([#141](https://github.com/ipfs/helia/issues/141)) ([271c403](https://github.com/ipfs/helia/commit/271c403009d378a35375a9468e41388ebb978f54))
* export libp2p service return type ([#263](https://github.com/ipfs/helia/issues/263)) ([76769cf](https://github.com/ipfs/helia/commit/76769cf33e06746f998b4f16b52d3e2a6a7a20a8))
* extend blockstore interface ([#55](https://github.com/ipfs/helia/issues/55)) ([42308c0](https://github.com/ipfs/helia/commit/42308c0d75e81789d909470ded90ad81ee0f84c7))
* **kubo:** ⬆️ Upgrading go-ipfs to kubo ([#251](https://github.com/ipfs/helia/issues/251)) ([963a7a2](https://github.com/ipfs/helia/commit/963a7a21774703a105c865a5b6db670f278eec73))
* listen on ip6 addresses ([#271](https://github.com/ipfs/helia/issues/271)) ([7ef5e79](https://github.com/ipfs/helia/commit/7ef5e79620f043522ff0dacc260af1fe83e5d77e))
* make all helia args optional ([#37](https://github.com/ipfs/helia/issues/37)) ([d15d76c](https://github.com/ipfs/helia/commit/d15d76cdc40a31bd1e47ca09583cc685583243b9))
* pass options to blockstore.get during pin.add ([#148](https://github.com/ipfs/helia/issues/148)) ([3a5234e](https://github.com/ipfs/helia/commit/3a5234e3c2f88f9910678b0cbbac5fd340117cc9))
* remove extra interface ([d577c61](https://github.com/ipfs/helia/commit/d577c61bcc6e4805d214b3ec4a39d78ee752a21e))
* remove trustless-gateway.link ([#301](https://github.com/ipfs/helia/issues/301)) ([0343725](https://github.com/ipfs/helia/commit/03437255213b14f5931aed91e8555d7fb7f92926))
* replace IPNI gateway with delegated routing client ([#297](https://github.com/ipfs/helia/issues/297)) ([57d580d](https://github.com/ipfs/helia/commit/57d580da26c5e28852cc9fe4d0d80adb36699ece))
* survive a cid causing an error during gc ([#38](https://github.com/ipfs/helia/issues/38)) ([5330188](https://github.com/ipfs/helia/commit/53301881dc6226ea3fc6823fd6e298e4d4796408))
* try circuit relay transport first ([#267](https://github.com/ipfs/helia/issues/267)) ([d5e9c3c](https://github.com/ipfs/helia/commit/d5e9c3c45c8dc3e63969105b785f6a836820a1f8))
* typedoc landing page uses readme ([#177](https://github.com/ipfs/helia/issues/177)) ([7fcce32](https://github.com/ipfs/helia/commit/7fcce328e934bf7e05e65176090a40ca822a555e)), closes [#176](https://github.com/ipfs/helia/issues/176)
* **types:** Add missing types ([#95](https://github.com/ipfs/helia/issues/95)) ([e858b8d](https://github.com/ipfs/helia/commit/e858b8dbbff548b42dde225db674f0edd1990ed3))
* update attempt to add helia to identify agent version ([#268](https://github.com/ipfs/helia/issues/268)) ([6dc7d55](https://github.com/ipfs/helia/commit/6dc7d55cd3099785417a7a2c99db755e856bd59a))
* update block events ([#58](https://github.com/ipfs/helia/issues/58)) ([d33be53](https://github.com/ipfs/helia/commit/d33be534972a4c238fc6d43c4284c6bd834ae218))
* update blocks interface to align with interface-blockstore ([#54](https://github.com/ipfs/helia/issues/54)) ([202b966](https://github.com/ipfs/helia/commit/202b966df3866d449751f775ed3edc9c92e32f6a))
* use release version of libp2p ([#59](https://github.com/ipfs/helia/issues/59)) ([a3a7c9c](https://github.com/ipfs/helia/commit/a3a7c9c2d81f2068fee85eeeca7425919f09e182))

## Changelog

Changelogs are available for monorepo projects at the following locations:

- [`/packages/interface`](./packages/interface/CHANGELOG.md) Helia API changelog
- [`/packages/helia`](./packages/helia/CHANGELOG.md) Helia implementation changelog
