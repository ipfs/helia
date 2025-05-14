# Changelog

## [3.1.1](https://github.com/ipfs/helia/compare/routers-v3.1.0...routers-v3.1.1) (2025-05-13)


### Dependencies

* update all deps ([#792](https://github.com/ipfs/helia/issues/792)) ([d43efc7](https://github.com/ipfs/helia/commit/d43efc7bdfff34071a8e4e22e01f659fbac0b78e))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.3.0 to ^5.3.1

## [3.1.0](https://github.com/ipfs/helia/compare/routers-v3.0.1...routers-v3.1.0) (2025-05-13)


### Features

* add provider shuffle option to HTTPGatewayRouter ([#772](https://github.com/ipfs/helia/issues/772)) ([daaa511](https://github.com/ipfs/helia/commit/daaa511a74583844244e6f51d55a8bc25a9f5f02))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.2.1 to ^5.3.0

## [3.0.1](https://github.com/ipfs/helia/compare/routers-v3.0.0...routers-v3.0.1) (2025-03-13)


### Documentation

* add spell checker to ci ([#743](https://github.com/ipfs/helia/issues/743)) ([45ca6bc](https://github.com/ipfs/helia/commit/45ca6bc70b1644028500101044595fa0e2199b07))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.2.0 to ^5.2.1

## [3.0.0](https://github.com/ipfs/helia/compare/routers-v2.2.0...routers-v3.0.0) (2025-01-14)


### ⚠ BREAKING CHANGES

* fix typo in HTTPGatewayRouter class/interface name ([#664](https://github.com/ipfs/helia/issues/664))

### Bug Fixes

* fix typo in HTTPGatewayRouter class/interface name ([#664](https://github.com/ipfs/helia/issues/664)) ([87aa9b4](https://github.com/ipfs/helia/commit/87aa9b4b21593870296c9a1c8b11c9123bbc5da1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.1.0 to ^5.2.0

## [2.2.0](https://github.com/ipfs/helia/compare/routers-v2.1.0...routers-v2.2.0) (2024-11-18)


### Features

* add cancelReprovide function to routing ([#672](https://github.com/ipfs/helia/issues/672)) ([dc13525](https://github.com/ipfs/helia/commit/dc1352563ab5ed7b204ae702c1e48035d196a470))


### Bug Fixes

* add tls to default delegated routing filters ([#670](https://github.com/ipfs/helia/issues/670)) ([aecac3d](https://github.com/ipfs/helia/commit/aecac3d92cbd22a7331afee8e6f87ef31a9f7d95))


### Dependencies

* bump aegir from 44.1.4 to 45.0.1 ([#669](https://github.com/ipfs/helia/issues/669)) ([e58e49c](https://github.com/ipfs/helia/commit/e58e49c6aed8ea9d1e9851435a25e33fdbee3781))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^5.0.0 to ^5.1.0

## [2.1.0](https://github.com/ipfs/helia/compare/routers-v2.0.0...routers-v2.1.0) (2024-10-23)


### Features

* enable customising delegated http router ([#654](https://github.com/ipfs/helia/issues/654)) ([693c82d](https://github.com/ipfs/helia/commit/693c82d2117536d89b2e82d9c482ad807af2e1be))

## [2.0.0](https://github.com/ipfs/helia/compare/routers-v1.1.1...routers-v2.0.0) (2024-10-07)


### ⚠ BREAKING CHANGES

* helia now uses libp2p@2.x.x

### Bug Fixes

* add doc-check script and export types used by functions ([#637](https://github.com/ipfs/helia/issues/637)) ([4f14996](https://github.com/ipfs/helia/commit/4f14996a9b976f2b60f4c8fe52a4fd1632420749))
* remove delegated routing api client patch ([#632](https://github.com/ipfs/helia/issues/632)) ([9de08ef](https://github.com/ipfs/helia/commit/9de08ef9c1cbdb723f524672f67574bf1dbed937))
* update to libp2p@2.x.x ([#630](https://github.com/ipfs/helia/issues/630)) ([ec8bf66](https://github.com/ipfs/helia/commit/ec8bf66dd870b42d6e5ef2b41706102397e0d39a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.1 to ^5.0.0

## [1.1.1](https://github.com/ipfs/helia/compare/routers-v1.1.0...routers-v1.1.1) (2024-07-31)


### Documentation

* fix grammar - it's -&gt; its ([#565](https://github.com/ipfs/helia/issues/565)) ([155e24d](https://github.com/ipfs/helia/commit/155e24db8c06c33972895d702a656e0c2996f3d9))


### Dependencies

* bump aegir from 42.2.11 to 43.0.1 ([#552](https://github.com/ipfs/helia/issues/552)) ([74ccc92](https://github.com/ipfs/helia/commit/74ccc92793a6d0bb4bee714d9fe4fa4183aa4ee8))
* bump aegir from 43.0.3 to 44.0.1 ([#569](https://github.com/ipfs/helia/issues/569)) ([6952f05](https://github.com/ipfs/helia/commit/6952f05357844e5aa3dffb2afaf261df06b9b7c1))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.3.0 to ^4.3.1

## [1.1.0](https://github.com/ipfs/helia/compare/routers-v1.0.3...routers-v1.1.0) (2024-05-01)


### Features

* add static http gateway routing ([#515](https://github.com/ipfs/helia/issues/515)) ([2d070b9](https://github.com/ipfs/helia/commit/2d070b9cfe0e225e4a66be85cceac900516a8a1f))


### Bug Fixes

* http blockbroker loads gateways from routing ([#519](https://github.com/ipfs/helia/issues/519)) ([6a62d1c](https://github.com/ipfs/helia/commit/6a62d1c8dcfadead0498d0bb59958837dc204c91))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.2.0 to ^4.3.0

## [1.0.3](https://github.com/ipfs/helia/compare/routers-v1.0.2...routers-v1.0.3) (2024-04-15)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.1.0 to ^4.2.0

## [1.0.2](https://github.com/ipfs/helia/compare/routers-v1.0.1...routers-v1.0.2) (2024-03-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.1 to ^4.1.0

## [1.0.1](https://github.com/ipfs/helia/compare/routers-v1.0.0...routers-v1.0.1) (2024-02-28)


### Bug Fixes

* update project deps and docs ([77e34fc](https://github.com/ipfs/helia/commit/77e34fc115cbfb82585fd954bcf389ecebf655bc))


### Dependencies

* update libp2p patch versions ([917a1bc](https://github.com/ipfs/helia/commit/917a1bceb9e9b56428a15dc3377a963f06affd12))
* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^4.0.0 to ^4.0.1

## 1.0.0 (2024-01-24)


### ⚠ BREAKING CHANGES

* the `libp2p` property has been removed from the `Helia` interface in `@helia/interface` - it is still present on the return type of `createHelia` from the `helia` module

### Features

* add @helia/http to monorepo ([#372](https://github.com/ipfs/helia/issues/372)) ([76220cd](https://github.com/ipfs/helia/commit/76220cd5adf45af7fa61fd0a1321de4722b744d6))


### Bug Fixes

* update ipns module to v9 and fix double verification of records ([#396](https://github.com/ipfs/helia/issues/396)) ([f2853f8](https://github.com/ipfs/helia/commit/f2853f8bd5bdcee8ab7a685355b0be47f29620e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @helia/interface bumped from ^3.0.1 to ^4.0.0
