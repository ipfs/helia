# Changelog

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
