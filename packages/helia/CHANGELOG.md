## [helia-v1.0.4](https://github.com/ipfs/helia/compare/helia-v1.0.3...helia-v1.0.4) (2023-05-04)


### Bug Fixes

* **types:** Add missing types ([#95](https://github.com/ipfs/helia/issues/95)) ([e858b8d](https://github.com/ipfs/helia/commit/e858b8dbbff548b42dde225db674f0edd1990ed3))


### Dependencies

* **dev:** bump libp2p from 0.43.4 to 0.44.0 ([#96](https://github.com/ipfs/helia/issues/96)) ([6e37d9f](https://github.com/ipfs/helia/commit/6e37d9f8be58955c5ddc5472fe3adb4bd9a0459c))


### Trivial Changes

* bump aegir from 38.1.8 to 39.0.4 ([#111](https://github.com/ipfs/helia/issues/111)) ([2156568](https://github.com/ipfs/helia/commit/215656870cb821dd6be2f8054dc39932ba25af14))

## [helia-v1.0.3](https://github.com/ipfs/helia/compare/helia-v1.0.2...helia-v1.0.3) (2023-04-05)


### Dependencies

* bump it-filter from 2.0.2 to 3.0.1 ([#74](https://github.com/ipfs/helia/issues/74)) ([3402724](https://github.com/ipfs/helia/commit/340272484df47d2f70f870d375ebb4235fb165a0))

## [helia-v1.0.2](https://github.com/ipfs/helia/compare/helia-v1.0.1...helia-v1.0.2) (2023-04-05)


### Dependencies

* bump it-drain from 2.0.1 to 3.0.1 ([#71](https://github.com/ipfs/helia/issues/71)) ([c6eaca1](https://github.com/ipfs/helia/commit/c6eaca1d21cf16527851fffc2411a8e3bd651f34))

## [helia-v1.0.1](https://github.com/ipfs/helia/compare/helia-v1.0.0...helia-v1.0.1) (2023-04-05)


### Dependencies

* bump it-all from 2.0.1 to 3.0.1 ([#72](https://github.com/ipfs/helia/issues/72)) ([e7ce5bc](https://github.com/ipfs/helia/commit/e7ce5bc0e0db0a6b41920a3c36b95eeea1863183))
* bump it-foreach from 1.0.1 to 2.0.2 ([#75](https://github.com/ipfs/helia/issues/75)) ([6f5f059](https://github.com/ipfs/helia/commit/6f5f0592edd44257092d0b70dd364096864495bf))

## helia-v1.0.0 (2023-03-23)


### Features

* add bitswap progress events ([#50](https://github.com/ipfs/helia/issues/50)) ([7460719](https://github.com/ipfs/helia/commit/7460719be44b4ff9bad629654efa29c56242e03a)), closes [#27](https://github.com/ipfs/helia/issues/27)
* add pinning API ([#36](https://github.com/ipfs/helia/issues/36)) ([270bb98](https://github.com/ipfs/helia/commit/270bb988eb8aefc8afe68e3580c3ef18960b3188)), closes [#28](https://github.com/ipfs/helia/issues/28) [/github.com/ipfs/helia/pull/36#issuecomment-1441403221](https://github.com/ipfs//github.com/ipfs/helia/pull/36/issues/issuecomment-1441403221) [#28](https://github.com/ipfs/helia/issues/28)
* initial implementation ([#17](https://github.com/ipfs/helia/issues/17)) ([343d360](https://github.com/ipfs/helia/commit/343d36016b164ed45cec4eb670d7f74860166ce4))


### Bug Fixes

* make all helia args optional ([#37](https://github.com/ipfs/helia/issues/37)) ([d15d76c](https://github.com/ipfs/helia/commit/d15d76cdc40a31bd1e47ca09583cc685583243b9))
* survive a cid causing an error during gc ([#38](https://github.com/ipfs/helia/issues/38)) ([5330188](https://github.com/ipfs/helia/commit/53301881dc6226ea3fc6823fd6e298e4d4796408))
* update blocks interface to align with interface-blockstore ([#54](https://github.com/ipfs/helia/issues/54)) ([202b966](https://github.com/ipfs/helia/commit/202b966df3866d449751f775ed3edc9c92e32f6a))
* use release version of libp2p ([#59](https://github.com/ipfs/helia/issues/59)) ([a3a7c9c](https://github.com/ipfs/helia/commit/a3a7c9c2d81f2068fee85eeeca7425919f09e182))


### Trivial Changes

* add release config ([a1c7ed0](https://github.com/ipfs/helia/commit/a1c7ed0560aaab032b641a78c9a76fc05a691a10))
* fix ci badge ([50929c0](https://github.com/ipfs/helia/commit/50929c01a38317f2f580609cc1b9c4c5485f32c8))
* release main ([#62](https://github.com/ipfs/helia/issues/62)) ([2bce77c](https://github.com/ipfs/helia/commit/2bce77c7d68735efca6ba602c215f432ba9b722d))
* update logo ([654a70c](https://github.com/ipfs/helia/commit/654a70cff9c222e4029ddd183d609514afc852ed))
* update publish config ([913ab6a](https://github.com/ipfs/helia/commit/913ab6ae9a2970c4b908de04b8b6a236b931a3b0))
* update release please config ([b52d5e3](https://github.com/ipfs/helia/commit/b52d5e3eecce41b10640426c339c99ad14ce874e))
* use wildcards for interop test deps ([29b4fb0](https://github.com/ipfs/helia/commit/29b4fb0ef58f53e6f7e1cf6fcb78fbb699f7b2a7))


### Dependencies

* update interface-store to 5.x.x ([#63](https://github.com/ipfs/helia/issues/63)) ([5bf11d6](https://github.com/ipfs/helia/commit/5bf11d638eee423624ac49af97757d730744f384))
* update sibling dependencies ([ac28d38](https://github.com/ipfs/helia/commit/ac28d3878f98a780fc57702921924fa92bd592a0))

# Changelog

## [0.1.0](https://www.github.com/ipfs/helia/compare/helia-v0.0.0...helia-v0.1.0) (2023-03-22)


### Features

* add bitswap progress events ([#50](https://www.github.com/ipfs/helia/issues/50)) ([7460719](https://www.github.com/ipfs/helia/commit/7460719be44b4ff9bad629654efa29c56242e03a)), closes [#27](https://www.github.com/ipfs/helia/issues/27)
* add pinning API ([#36](https://www.github.com/ipfs/helia/issues/36)) ([270bb98](https://www.github.com/ipfs/helia/commit/270bb988eb8aefc8afe68e3580c3ef18960b3188)), closes [#28](https://www.github.com/ipfs/helia/issues/28)
* initial implementation ([#17](https://www.github.com/ipfs/helia/issues/17)) ([343d360](https://www.github.com/ipfs/helia/commit/343d36016b164ed45cec4eb670d7f74860166ce4))


### Bug Fixes

* make all helia args optional ([#37](https://www.github.com/ipfs/helia/issues/37)) ([d15d76c](https://www.github.com/ipfs/helia/commit/d15d76cdc40a31bd1e47ca09583cc685583243b9))
* survive a cid causing an error during gc ([#38](https://www.github.com/ipfs/helia/issues/38)) ([5330188](https://www.github.com/ipfs/helia/commit/53301881dc6226ea3fc6823fd6e298e4d4796408))
* update blocks interface to align with interface-blockstore ([#54](https://www.github.com/ipfs/helia/issues/54)) ([202b966](https://www.github.com/ipfs/helia/commit/202b966df3866d449751f775ed3edc9c92e32f6a))
* use release version of libp2p ([#59](https://www.github.com/ipfs/helia/issues/59)) ([a3a7c9c](https://www.github.com/ipfs/helia/commit/a3a7c9c2d81f2068fee85eeeca7425919f09e182))



### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ~0.0.0 to ^0.1.0
