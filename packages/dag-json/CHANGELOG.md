# Changelog

## [4.0.0](https://github.com/ipfs/helia/compare/dag-json-v3.0.6...dag-json-v4.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* helia now uses libp2p@2.x.x

### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0

## [3.0.6](https://github.com/ipfs/helia/compare/dag-json-v3.0.5...dag-json-v3.0.6) (2024-09-13)


### Bug Fixes

* remove @libp2p/interfaces dep ([#591](https://github.com/ipfs/helia/issues/591)) ([e567717](https://github.com/ipfs/helia/commit/e567717102464a925f87cb10fc05808a50be960e))

## [3.0.5](https://github.com/ipfs/helia/compare/dag-json-v3.0.4...dag-json-v3.0.5) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

## [3.0.4](https://github.com/ipfs/helia/compare/dag-json-v3.0.3...dag-json-v3.0.4) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [3.0.3](https://github.com/ipfs/helia/compare/dag-json-v3.0.2...dag-json-v3.0.3) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [3.0.2](https://github.com/ipfs/helia/compare/dag-json-v3.0.1...dag-json-v3.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [3.0.1](https://github.com/ipfs/helia/compare/dag-json-v3.0.0...dag-json-v3.0.1) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/dag-json-v2.0.1...dag-json-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/dag-json-v1.0.3...dag-json-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3

### Features

* update helia to v3 and multiformats to v13 ([#45](https://github.com/ipfs/helia-dag-json/issues/45)) ([3c7d9d4](https://github.com/ipfs/helia/commit/3c7d9d4a8e74e1a808c265fbc6ecbdc24f0f3da9))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1

## [1.0.3](https://github.com/ipfs/helia/compare/dag-json-v1.0.2...dag-json-v1.0.3) (2023-10-07)


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#32](https://github.com/ipfs/helia-dag-json/issues/32)) ([eb836ef](https://github.com/ipfs/helia/commit/eb836ef15f6bc754fbab4fdbe47c76f5492a56d9))
* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#36](https://github.com/ipfs/helia-dag-json/issues/36)) ([9f57d11](https://github.com/ipfs/helia/commit/9f57d11e461a3b1fddbc2a92e225d31eee56613c))

## [1.0.2](https://github.com/ipfs/helia/compare/dag-json-v1.0.1...dag-json-v1.0.2) (2023-08-27)


### Dependencies

* bump multiformats from 11.0.2 to 12.0.1 ([#8](https://github.com/ipfs/helia-dag-json/issues/8)) ([c89b8f1](https://github.com/ipfs/helia/commit/c89b8f12d700f0e23dc574cc32f7726d9c9558de))

## [1.0.1](https://github.com/ipfs/helia/compare/dag-json-v1.0.0...dag-json-v1.0.1) (2023-08-27)


### Dependencies

* **dev:** bump aegir from 39.0.13 to 40.0.11 ([#28](https://github.com/ipfs/helia-dag-json/issues/28)) ([d126e6a](https://github.com/ipfs/helia/commit/d126e6a3c845f25a4910c18fa476304d8534be91))

## 1.0.0 (2023-05-03)


### Trivial Changes

* fix linting ([9d9d341](https://github.com/ipfs/helia/commit/9d9d341583d34c4516e5cfaa8bccfd5b6ac860a1))


### Documentation

* replace references to json with dag-json ([f1944b0](https://github.com/ipfs/helia/commit/f1944b04271a599eee987d56d4d8506eaeb8a69d))
* update tocs ([0b4bac4](https://github.com/ipfs/helia/commit/0b4bac4583f790686ceaf89f2f2ab6642677c4fd))
