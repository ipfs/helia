# Changelog

## [4.0.0](https://github.com/ipfs/helia/compare/json-v3.0.6...json-v4.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* helia now uses libp2p@2.x.x

### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0

## [3.0.6](https://github.com/ipfs/helia/compare/json-v3.0.5...json-v3.0.6) (2024-09-13)


### Bug Fixes

* remove @libp2p/interfaces dep ([#591](https://github.com/ipfs/helia/issues/591)) ([e567717](https://github.com/ipfs/helia/commit/e567717102464a925f87cb10fc05808a50be960e))

## [3.0.5](https://github.com/ipfs/helia/compare/json-v3.0.4...json-v3.0.5) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

## [3.0.4](https://github.com/ipfs/helia/compare/json-v3.0.3...json-v3.0.4) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [3.0.3](https://github.com/ipfs/helia/compare/json-v3.0.2...json-v3.0.3) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [3.0.2](https://github.com/ipfs/helia/compare/json-v3.0.1...json-v3.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [3.0.1](https://github.com/ipfs/helia/compare/json-v3.0.0...json-v3.0.1) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/json-v2.0.1...json-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/json-v1.0.3...json-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3

### Features

* update helia to v3 and multiformats to v13 ([#46](https://github.com/ipfs/helia-json/issues/46)) ([e3dc586](https://github.com/ipfs/helia/commit/e3dc5867ffc4de0dd3b05b56eb1b0ce98d50dcb1))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1

## [1.0.3](https://github.com/ipfs/helia/compare/json-v1.0.2...json-v1.0.3) (2023-10-07)


### Dependencies

* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#36](https://github.com/ipfs/helia-json/issues/36)) ([ca3f05a](https://github.com/ipfs/helia/commit/ca3f05a74316f53b0e44f5edd6e303b6e8463bf2))

## [1.0.2](https://github.com/ipfs/helia/compare/json-v1.0.1...json-v1.0.2) (2023-08-27)


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#34](https://github.com/ipfs/helia-json/issues/34)) ([d48f2c5](https://github.com/ipfs/helia/commit/d48f2c58338af0d096a1f855ab85a621fce1cc01))
* bump multiformats from 11.0.2 to 12.0.1 ([#8](https://github.com/ipfs/helia-json/issues/8)) ([c2a2ee3](https://github.com/ipfs/helia/commit/c2a2ee38cc8fa76c8a6d0c92c44023c148148a7e))

## [1.0.1](https://github.com/ipfs/helia/compare/json-v1.0.0...json-v1.0.1) (2023-08-27)


### Dependencies

* **dev:** bump aegir from 39.0.13 to 40.0.11 ([#26](https://github.com/ipfs/helia-json/issues/26)) ([37b6ba1](https://github.com/ipfs/helia/commit/37b6ba14e085073b966fced3c3777519601d0a81))

## 1.0.0 (2023-05-03)


### Documentation

* update comment ([1e0d49a](https://github.com/ipfs/helia/commit/1e0d49a4ecb94b1ef07b8a814a095cea533222a3))
