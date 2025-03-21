# Changelog

## [4.0.4](https://github.com/ipfs/helia/compare/car-v4.0.3...car-v4.0.4) (2025-03-20)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/mfs bumped from ^4.0.3 to ^5.0.0
    * @helia/unixfs bumped from ^4.0.3 to ^5.0.0

## [4.0.3](https://github.com/ipfs/helia/compare/car-v4.0.2...car-v4.0.3) (2025-03-13)


### Documentation

* add spell checker to ci ([#743](https://github.com/ipfs/helia/issues/743)) ([45ca6bc](https://github.com/ipfs/helia/commit/45ca6bc70b1644028500101044595fa0e2199b07))
* update @helia/car export method example ([#761](https://github.com/ipfs/helia/issues/761)) ([73cb631](https://github.com/ipfs/helia/commit/73cb631e7347688012f429cd69b1046db249e694))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.2.0 to ^5.2.1
  * devDependencies
    * @helia/mfs bumped from ^4.0.2 to ^4.0.3
    * @helia/unixfs bumped from ^4.0.2 to ^4.0.3

## [4.0.2](https://github.com/ipfs/helia/compare/car-v4.0.1...car-v4.0.2) (2025-01-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.1.0 to ^5.2.0
  * devDependencies
    * @helia/mfs bumped from ^4.0.1 to ^4.0.2
    * @helia/unixfs bumped from ^4.0.1 to ^4.0.2

## [4.0.1](https://github.com/ipfs/helia/compare/car-v4.0.0...car-v4.0.1) (2024-11-18)


### Dependencies

* bump aegir from 44.1.4 to 45.0.1 ([#669](https://github.com/ipfs/helia/issues/669)) ([e58e49c](https://github.com/ipfs/helia/commit/e58e49c6aed8ea9d1e9851435a25e33fdbee3781))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.0.0 to ^5.1.0
  * devDependencies
    * @helia/mfs bumped from ^4.0.0 to ^4.0.1
    * @helia/unixfs bumped from ^4.0.0 to ^4.0.1

## [4.0.0](https://github.com/ipfs/helia/compare/car-v3.2.1...car-v4.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* the `.dagWalkers` property has been removed
* helia now uses libp2p@2.x.x

### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* replace dag walkers with generic CID extraction from blocks ([#447](https://github.com/ipfs/helia/issues/447)) ([5ff6998](https://github.com/ipfs/helia/commit/5ff6998e6bc8b04e3407bc98c1924c55f632d9b7))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0
  * devDependencies
    * @helia/mfs bumped from ^3.0.8 to ^4.0.0
    * @helia/unixfs bumped from ^3.0.7 to ^4.0.0

## [3.2.1](https://github.com/ipfs/helia/compare/car-v3.2.0...car-v3.2.1) (2024-09-13)


### Bug Fixes

* remove @libp2p/interfaces dep ([#591](https://github.com/ipfs/helia/issues/591)) ([e567717](https://github.com/ipfs/helia/commit/e567717102464a925f87cb10fc05808a50be960e))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/mfs bumped from ^3.0.7 to ^3.0.8

## [3.2.0](https://github.com/ipfs/helia/compare/car-v3.1.5...car-v3.2.0) (2024-07-31)


### Features

* add `filter` option to de-duplicate blocks in car files ([461d219](https://github.com/ipfs/helia/commit/461d219927a6725508014392340820d01a76a64f))


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1
  * devDependencies
    * @helia/mfs bumped from ^3.0.6 to ^3.0.7
    * @helia/unixfs bumped from ^3.0.6 to ^3.0.7

## [3.1.5](https://github.com/ipfs/helia/compare/car-v3.1.4...car-v3.1.5) (2024-05-01)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0
  * devDependencies
    * @helia/unixfs bumped from ^3.0.5 to ^3.0.6

## [3.1.4](https://github.com/ipfs/helia/compare/car-v3.1.3...car-v3.1.4) (2024-04-22)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/unixfs bumped from ^3.0.4 to ^3.0.5

## [3.1.3](https://github.com/ipfs/helia/compare/car-v3.1.2...car-v3.1.3) (2024-04-15)


### Bug Fixes

* add sideEffects: false to package.json ([#485](https://github.com/ipfs/helia/issues/485)) ([8c45267](https://github.com/ipfs/helia/commit/8c45267a474ab10b2faadfebdab33cfe446e8c03))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0
  * devDependencies
    * @helia/unixfs bumped from ^3.0.3 to ^3.0.4

## [3.1.2](https://github.com/ipfs/helia/compare/car-v3.1.1...car-v3.1.2) (2024-04-03)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @helia/unixfs bumped from ^3.0.2 to ^3.0.3

## [3.1.1](https://github.com/ipfs/helia/compare/car-v3.1.0...car-v3.1.1) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0
  * devDependencies
    * @helia/unixfs bumped from ^3.0.1 to ^3.0.2

## [3.1.0](https://github.com/ipfs/helia/compare/car-v3.0.0...car-v3.1.0) (2024-02-28)


### Features

* stream car file bytes from @helia/car ([#444](https://github.com/ipfs/helia/issues/444)) ([7c07e11](https://github.com/ipfs/helia/commit/7c07e113d644a1efc32b7fd0c268f5f892256ce9))


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1
  * devDependencies
    * @helia/unixfs bumped from ^3.0.0 to ^3.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/car-v2.0.1...car-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))
* expose configured dag walkers and hashers on helia interface ([#381](https://github.com/ipfs/helia/issues/381)) ([843fba4](https://github.com/ipfs/helia/commit/843fba467ebb032907c888da499147a5349ec10e)), closes [#375](https://github.com/ipfs/helia/issues/375)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0
  * devDependencies
    * @helia/unixfs bumped from ^2.0.1 to ^3.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/car-v1.0.4...car-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3

### Features

* update helia to v3 and multiformats to v13 ([#52](https://github.com/ipfs/helia-car/issues/52)) ([6405c34](https://github.com/ipfs/helia/commit/6405c3487879614dc4dd7308b15c946d644e0488))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1
  * devDependencies
    * @helia/unixfs bumped from ^2.0.0 to ^2.0.1


## [1.0.4](https://github.com/ipfs/helia/compare/car-v1.0.3...car-v1.0.4) (2023-10-07)


### Dependencies

* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#41](https://github.com/ipfs/helia-car/issues/41)) ([e8fc99f](https://github.com/ipfs/helia/commit/e8fc99f4e372eaf72c2598f5a7a9942143c6d788))

## [1.0.3](https://github.com/ipfs/helia/compare/car-v1.0.2...car-v1.0.3) (2023-08-27)


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#32](https://github.com/ipfs/helia-car/issues/32)) ([68656a8](https://github.com/ipfs/helia/commit/68656a81b7cd1238641a41573915635905e4a6ed))
* bump cborg from 1.10.2 to 2.0.5 ([#35](https://github.com/ipfs/helia-car/issues/35)) ([10994ea](https://github.com/ipfs/helia/commit/10994ea9abdff8906ae8c3f7d0ff5f50b50d9e60))
* bump multiformats from 11.0.2 to 12.0.1 ([#4](https://github.com/ipfs/helia-car/issues/4)) ([50bed0f](https://github.com/ipfs/helia/commit/50bed0f32b3c07111de804b0e6471e36d8e66626))

## [1.0.2](https://github.com/ipfs/helia/compare/car-v1.0.1...car-v1.0.2) (2023-08-27)


### Dependencies

* **dev:** bump aegir from 39.0.13 to 40.0.11 ([#30](https://github.com/ipfs/helia-car/issues/30)) ([ea26a0b](https://github.com/ipfs/helia/commit/ea26a0bd14137eb1de6ab282cdcecd55578064ab))

## [1.0.1](https://github.com/ipfs/helia/compare/car-v1.0.0...car-v1.0.1) (2023-08-14)


### Documentation

* fs already defined in example ([#1](https://github.com/ipfs/helia-car/issues/1)) ([356797a](https://github.com/ipfs/helia/commit/356797a9493c7753178b5f343962951bc9cd3052))

## 1.0.0 (2023-06-07)


### Bug Fixes

* import from multiformats/cid for smaller bundles ([0857d1f](https://github.com/ipfs/helia/commit/0857d1f76cd7403dbea46cf3d9c891543fc83fe1))


### Trivial Changes

* fix linting ([3803a37](https://github.com/ipfs/helia/commit/3803a378c0d7a556248e39e7a3c756e94e69888d))
