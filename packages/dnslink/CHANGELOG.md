# Changelog

## [1.1.3](https://github.com/ipfs/helia/compare/dnslink-v1.1.2...dnslink-v1.1.3) (2025-11-10)


### Bug Fixes

* support recursive DNSLink lookups ([#897](https://github.com/ipfs/helia/issues/897)) ([636e950](https://github.com/ipfs/helia/commit/636e9503ff56e49c2209f6af480df36b7a8c3735))

## [1.1.2](https://github.com/ipfs/helia/compare/dnslink-v1.1.1...dnslink-v1.1.2) (2025-10-29)


### Bug Fixes

* use libp2p provider routing field ([#889](https://github.com/ipfs/helia/issues/889)) ([d4d97b8](https://github.com/ipfs/helia/commit/d4d97b83f76be7e3b480052467408839f808e230))

## [1.1.1](https://github.com/ipfs/helia/compare/dnslink-v1.1.0...dnslink-v1.1.1) (2025-10-22)


### Bug Fixes

* update log formatting to print errors correctly ([#884](https://github.com/ipfs/helia/issues/884)) ([f35ecd1](https://github.com/ipfs/helia/commit/f35ecd1c8ad3c712d3882d0f0f2abaf0f0296ec1))

## [1.1.0](https://github.com/ipfs/helia/compare/dnslink-v1.0.1...dnslink-v1.1.0) (2025-10-14)


### Features

* add lookup cache ([#869](https://github.com/ipfs/helia/issues/869)) ([bb88944](https://github.com/ipfs/helia/commit/bb889444c85270e891d384f2ca9d2789f5ad37d6))

## [1.0.1](https://github.com/ipfs/helia/compare/dnslink-v1.0.0...dnslink-v1.0.1) (2025-10-09)


### Bug Fixes

* support multiple DNSLink entries ([#863](https://github.com/ipfs/helia/issues/863)) ([fe38409](https://github.com/ipfs/helia/commit/fe384098a0930915eff4c41d562606955e0e710d)), closes [#368](https://github.com/ipfs/helia/issues/368)

## 1.0.0 (2025-10-09)


### ⚠ BREAKING CHANGES

* `ipns.publish` now accepts key name strings rather than private keys Names previously publishing using an user controlled private key, will need to be explicitly published again by first importing the key into the keychain (`await libp2p.keychain.importKey('my-key', key)` and then published with `ipns.publish('my-key', ...)`.

### Features

* add ipns reproviding/republishing ([#764](https://github.com/ipfs/helia/issues/764)) ([008747b](https://github.com/ipfs/helia/commit/008747b59a03682e1b6f648a39635e1b1971e481))
