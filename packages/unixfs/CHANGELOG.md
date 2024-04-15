# Changelog

## [3.0.3](https://github.com/ipfs/helia/compare/unixfs-v3.0.2...unixfs-v3.0.3) (2024-04-03)


### Bug Fixes

* Add GlobSourceResult to globSource return type in unixfs. ([#475](https://github.com/ipfs/helia/issues/475)) ([9ac5909](https://github.com/ipfs/helia/commit/9ac59098d3e4c8644756a83b185308d7d91626c1))

## [3.0.2](https://github.com/ipfs/helia/compare/unixfs-v3.0.1...unixfs-v3.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [3.0.1](https://github.com/ipfs/helia/compare/unixfs-v3.0.0...unixfs-v3.0.1) (2024-02-28)


### Bug Fixes

* support reading identity cids ([#429](https://github.com/ipfs/helia/issues/429)) ([98308f7](https://github.com/ipfs/helia/commit/98308f77488b8196b2d18f78f05ecd2d37456834))
* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))
* use blockstore interface where possible ([#417](https://github.com/ipfs/helia/issues/417)) ([30c8981](https://github.com/ipfs/helia/commit/30c8981934ffba72d572a7b8b2712ec93b7f4d31))
* use unixfs exporter to traverse DAGs ([#455](https://github.com/ipfs/helia/issues/455)) ([6f8c15b](https://github.com/ipfs/helia/commit/6f8c15b769c08bf73e7c62dab79909b5ecfc3c93))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## [3.0.0](https://github.com/ipfs/helia/compare/unixfs-v2.0.1...unixfs-v3.0.0) (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0

## [2.0.0](https://github.com/ipfs/helia/compare/unixfs-v1.4.3...unixfs-v2.0.0) (2024-01-08)


### ⚠ BREAKING CHANGES

* uses multiformats v13 and helia v3

### Features

* update helia to v3 and multiformats to v13 ([#147](https://github.com/ipfs/helia-unixfs/issues/147)) ([001247c](https://github.com/ipfs/helia/commit/001247c6fc38ff3d810736371de901e5e1099f26))


### Trivial Changes

* update sibling dependencies ([1b0b2ef](https://github.com/ipfs/helia/commit/1b0b2ef05c5cbd78c3b5d5629237200a69bbd5dd))

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.0 to ^3.0.1

## [1.4.3](https://github.com/ipfs/helia/compare/unixfs-v1.4.2...unixfs-v1.4.3) (2023-12-03)


### Bug Fixes

* convert date to mtime in glob source ([#106](https://github.com/ipfs/helia-unixfs/issues/106)) ([cd9e903](https://github.com/ipfs/helia/commit/cd9e903c2ccac61372eaa64a61b4a8f3d79f9d4a))


### Dependencies

* **dev:** bump aegir from 40.0.13 to 41.0.0 ([#105](https://github.com/ipfs/helia-unixfs/issues/105)) ([2421ee2](https://github.com/ipfs/helia/commit/2421ee2b4440446160e1a665bc5ecfc92d2b64de))

## [1.4.2](https://github.com/ipfs/helia/compare/unixfs-v1.4.1...unixfs-v1.4.2) (2023-09-14)


### Dependencies

* bump @helia/interface from 1.2.2 to 2.0.0 ([#87](https://github.com/ipfs/helia-unixfs/issues/87)) ([098a305](https://github.com/ipfs/helia/commit/098a305241024ed3903b686892ded8abfca55f5f))

## [1.4.1](https://github.com/ipfs/helia/compare/unixfs-v1.4.0...unixfs-v1.4.1) (2023-07-25)


### Bug Fixes

* correct browser override path for glob-source ([#60](https://github.com/ipfs/helia-unixfs/issues/60)) ([fd0f33b](https://github.com/ipfs/helia/commit/fd0f33b2a66e2840b5a03f27a48240b3c5d2b67e))


### Documentation

* fix typos in example code ([#57](https://github.com/ipfs/helia-unixfs/issues/57)) ([b7625c3](https://github.com/ipfs/helia/commit/b7625c3426380e63052968b1476e2d689c9213de))

## [1.4.0](https://github.com/ipfs/helia/compare/unixfs-v1.3.0...unixfs-v1.4.0) (2023-06-30)


### Features

* add globSource and urlSource ([#53](https://github.com/ipfs/helia-unixfs/issues/53)) ([b490a6e](https://github.com/ipfs/helia/commit/b490a6e35cb521c0c29d0f1382fc2e4b3b662b9c))

## [1.3.0](https://github.com/ipfs/helia/compare/unixfs-v1.2.4...unixfs-v1.3.0) (2023-06-07)


### Features

* add offline option to all operations ([#51](https://github.com/ipfs/helia-unixfs/issues/51)) ([444c8bd](https://github.com/ipfs/helia/commit/444c8bd0dd40d8cad7ca12f3fbffaaf19f8e75fc))

## [1.2.4](https://github.com/ipfs/helia/compare/unixfs-v1.2.3...unixfs-v1.2.4) (2023-06-07)


### Bug Fixes

* export unixfs errors ([#50](https://github.com/ipfs/helia-unixfs/issues/50)) ([8426d65](https://github.com/ipfs/helia/commit/8426d650ae4645b7b975331c5fd02f56e390cab6))

## [1.2.3](https://github.com/ipfs/helia/compare/unixfs-v1.2.2...unixfs-v1.2.3) (2023-06-07)


### Dependencies

* update all deps and fix linting ([d4d6515](https://github.com/ipfs/helia/commit/d4d6515f023db339874d34871e69fb7c3fc47f6c))

## [1.2.2](https://github.com/ipfs/helia/compare/unixfs-v1.2.1...unixfs-v1.2.2) (2023-04-12)


### Dependencies

* update all it-* deps to latest versions ([#25](https://github.com/ipfs/helia-unixfs/issues/25)) ([9388c40](https://github.com/ipfs/helia/commit/9388c402462a1d45fcb7ded285262881718b7dd0))

## [1.2.1](https://github.com/ipfs/helia/compare/unixfs-v1.2.0...unixfs-v1.2.1) (2023-03-23)


### Dependencies

* update helia deps to v1 ([#16](https://github.com/ipfs/helia-unixfs/issues/16)) ([7497590](https://github.com/ipfs/helia/commit/74975903ec619a4662e5bfa9546997641e9f8e8c))

## [1.2.0](https://github.com/ipfs/helia/compare/unixfs-v1.1.0...unixfs-v1.2.0) (2023-03-17)


### Features

* expose unixfs progress events in types ([#14](https://github.com/ipfs/helia-unixfs/issues/14)) ([36cf3b2](https://github.com/ipfs/helia/commit/36cf3b2143276a59b685ceb58299c4f881545fee))

## [1.1.0](https://github.com/ipfs/helia/compare/unixfs-v1.0.5...unixfs-v1.1.0) (2023-03-15)


### Features

* expose progress events from importer, blockstore and bitswap ([#13](https://github.com/ipfs/helia-unixfs/issues/13)) ([de78f4d](https://github.com/ipfs/helia/commit/de78f4d03ebafe9ed9a2dfcbfb7a516fa215585c))


### Trivial Changes

* add interop test suite ([#12](https://github.com/ipfs/helia-unixfs/issues/12)) ([3ad5f5d](https://github.com/ipfs/helia/commit/3ad5f5d8199a5596aa333916d4a240584bc0842a))

## [1.0.5](https://github.com/ipfs/helia/compare/unixfs-v1.0.4...unixfs-v1.0.5) (2023-03-14)


### Bug Fixes

* align defaults with filecoin ([#6](https://github.com/ipfs/helia-unixfs/issues/6)) ([a6bd198](https://github.com/ipfs/helia/commit/a6bd1983bd7baac21af3de6fa269219f52664cde))

## [1.0.4](https://github.com/ipfs/helia/compare/unixfs-v1.0.3...unixfs-v1.0.4) (2023-02-27)


### Bug Fixes

* simplify shard handling ([#5](https://github.com/ipfs/helia-unixfs/issues/5)) ([52d4786](https://github.com/ipfs/helia/commit/52d4786831c3b2b60322de562b752ecfbc8791bb))

## [1.0.3](https://github.com/ipfs/helia/compare/unixfs-v1.0.2...unixfs-v1.0.3) (2023-02-25)


### Bug Fixes

* enable last shard tests ([#4](https://github.com/ipfs/helia-unixfs/issues/4)) ([9774460](https://github.com/ipfs/helia/commit/97744606d6da2e61a1aefa6af8f0f3b68f8827ab))

## [1.0.2](https://github.com/ipfs/helia/compare/unixfs-v1.0.1...unixfs-v1.0.2) (2023-02-24)


### Bug Fixes

* add methods to import data ([#3](https://github.com/ipfs/helia-unixfs/issues/3)) ([917a564](https://github.com/ipfs/helia/commit/917a564c0d990dfd35d4615436fc8e3609c72a76))


### Tests

* move test file data to fixtures ([1b76084](https://github.com/ipfs/helia/commit/1b760847a18b7b7c1e3fa8c871fd75acb298480b))

## [1.0.1](https://github.com/ipfs/helia/compare/unixfs-v1.0.0...unixfs-v1.0.1) (2023-02-17)


### Bug Fixes

* update unixfs importer ([f6edeca](https://github.com/ipfs/helia/commit/f6edeca471da4aaa2171b0b3f2d2ea91d527a00e))

## 1.0.0 (2023-02-16)


### Features

* initial implementation ([#1](https://github.com/ipfs/helia-unixfs/issues/1)) ([adb6b0e](https://github.com/ipfs/helia/commit/adb6b0e2626a3bdd08cdc4445e3367f104bc5bb8))


### Trivial Changes

* initial commit ([35e8a8f](https://github.com/ipfs/helia/commit/35e8a8fd7c1ca68b21320b95211304bf01b30086))
* Update .github/workflows/stale.yml [skip ci] ([bcb060d](https://github.com/ipfs/helia/commit/bcb060d880175ab885479388049a1ca2e5873629))


### Documentation

* update readme ([83e5e0e](https://github.com/ipfs/helia/commit/83e5e0e0ccfd27f9371c9a8940c237e398e9b68f))
