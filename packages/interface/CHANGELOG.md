## [@helia/interface-v1.2.2](https://github.com/ipfs/helia/compare/@helia/interface-v1.2.1...@helia/interface-v1.2.2) (2023-08-05)


### Trivial Changes

* update project config ([#175](https://github.com/ipfs/helia/issues/175)) ([f185a72](https://github.com/ipfs/helia/commit/f185a7220a62f7fc0c025aa5c0be5a981c63cc48))


### Dependencies

* **dev:** bump aegir from 39.0.13 to 40.0.8 ([#198](https://github.com/ipfs/helia/issues/198)) ([4d75ecf](https://github.com/ipfs/helia/commit/4d75ecffb79e5177da35d3106e42dac7bc63153a))

## [@helia/interface-v1.2.1](https://github.com/ipfs/helia/compare/@helia/interface-v1.2.0...@helia/interface-v1.2.1) (2023-06-07)


### Bug Fixes

* pass options to blockstore.get during pin.add ([#148](https://github.com/ipfs/helia/issues/148)) ([3a5234e](https://github.com/ipfs/helia/commit/3a5234e3c2f88f9910678b0cbbac5fd340117cc9))

## [@helia/interface-v1.2.0](https://github.com/ipfs/helia/compare/@helia/interface-v1.1.1...@helia/interface-v1.2.0) (2023-06-07)


### Features

* add offline option to blockstore get ([#145](https://github.com/ipfs/helia/issues/145)) ([71c5f6b](https://github.com/ipfs/helia/commit/71c5f6bc32b324ee237e56c2c5a1ce903b3bdbef))


### Trivial Changes

* update changelogs ([#142](https://github.com/ipfs/helia/issues/142)) ([fefd374](https://github.com/ipfs/helia/commit/fefd3744c0a6d8471de31762ece6ec59b65496c1))

## [@helia/interface-v1.1.1](https://github.com/ipfs/helia/compare/@helia/interface-v1.1.0...@helia/interface-v1.1.1) (2023-05-19)


### Bug Fixes

* add helia version to agent version ([#128](https://github.com/ipfs/helia/issues/128)) ([48e19ec](https://github.com/ipfs/helia/commit/48e19ec545cc67157e14ae59054fa377a583cb01)), closes [#122](https://github.com/ipfs/helia/issues/122)

## [@helia/interface-v1.1.0](https://github.com/ipfs/helia/compare/@helia/interface-v1.0.0...@helia/interface-v1.1.0) (2023-05-19)


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
