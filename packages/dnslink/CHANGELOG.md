# Changelog

## 1.0.0 (2025-10-09)


### ⚠ BREAKING CHANGES

* `ipns.publish` now accepts key name strings rather than private keys Names previously publishing using an user controlled private key, will need to be explicitly published again by first importing the key into the keychain (`await libp2p.keychain.importKey('my-key', key)` and then published with `ipns.publish('my-key', ...)`.

### Features

* add ipns reproviding/republishing ([#764](https://github.com/ipfs/helia/issues/764)) ([008747b](https://github.com/ipfs/helia/commit/008747b59a03682e1b6f648a39635e1b1971e481))
