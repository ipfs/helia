# Changelog

## [4.0.2](https://github.com/ipfs/helia/compare/strings-v4.0.1...strings-v4.0.2) (2025-01-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.1.0 to ^5.2.0

## [4.0.1](https://github.com/ipfs/helia/compare/strings-v4.0.0...strings-v4.0.1) (2024-11-18)


### Dependencies

* bump aegir from 44.1.4 to 45.0.1 ([#669](https://github.com/ipfs/helia/issues/669)) ([e58e49c](https://github.com/ipfs/helia/commit/e58e49c6aed8ea9d1e9851435a25e33fdbee3781))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.0.0 to ^5.1.0

## [4.0.0](https://github.com/ipfs/helia/compare/strings-v3.0.6...strings-v4.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* helia now uses libp2p@2.x.x

### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0

## [3.0.6](https://github.com/ipfs/helia/compare/strings-v3.0.5...strings-v3.0.6) (2024-09-13)


### Bug Fixes

* remove @libp2p/interfaces dep ([#591](https://github.com/ipfs/helia/issues/591)) ([e567717](https://github.com/ipfs/helia/commit/e567717102464a925f87cb10fc05808a50be960e))

## [3.0.5](https://github.com/ipfs/helia/compare/strings-v3.0.4...strings-v3.0.5) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

## [3.0.4](https://github.com/ipfs/helia/compare/strings-v3.0.3...strings-v3.0.4) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [3.0.3](https://github.com/ipfs/helia/compare/strings-v3.0.2...strings-v3.0.3) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [3.0.2](https://github.com/ipfs/helia/compare/strings-v3.0.1...strings-v3.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [3.0.1](https://github.com/ipfs/helia/compare/strings-v3.0.0...strings-v3.0.1) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/strings-v2.0.1...strings-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/strings-v1.0.1...strings-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3

### Features

* update helia to v3 and multiformats to v13 ([#87](https://github.com/ipfs/helia-strings/issues/87)) ([ae7cbc9](https://github.com/ipfs/helia/commit/ae7cbc9a16a267cb0f6d7cecd381f919430afaea))


### Trivial Changes

* update sibling dependencies ([1184ea6](https://github.com/ipfs/helia/commit/1184ea695987cee7f922b7954c8bc626bc035dba))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1

## [1.0.1](https://github.com/ipfs/helia/compare/strings-v1.0.0...strings-v1.0.1) (2023-10-06)


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#39](https://github.com/ipfs/helia-strings/issues/39)) ([7c9bc2e](https://github.com/ipfs/helia/commit/7c9bc2e9f99ccbaec1d8c25c900585deb5f6a327))

## 1.0.0 (2023-05-03)


### Bug Fixes

* linting and deps ([22d3900](https://github.com/ipfs/helia/commit/22d3900c15b0876419460c4db57b41f91e78d52f))


### Documentation

* update readme ([#6](https://github.com/ipfs/helia-strings/issues/6)) ([c62f784](https://github.com/ipfs/helia/commit/c62f78499d75ba96da60a4de2f6a0ae3f007abfb))
* update readmes ([2a700dc](https://github.com/ipfs/helia/commit/2a700dc30945857e5ec596a8551adf488dc18009))
* update tocs ([3d4573d](https://github.com/ipfs/helia/commit/3d4573d9bc22bdd79043b6fec570e8410c8d1228))
