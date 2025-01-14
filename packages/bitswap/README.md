# @helia/bitswap

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/main.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/main.yml?query=branch%3Amain)

> JavaScript implementation of the Bitswap data exchange protocol used by Helia

# About

<!--

!IMPORTANT!

Everything in this README between "# About" and "# Install" is automatically
generated and will be overwritten the next time the doc generator is run.

To make changes to this section, please update the @packageDocumentation section
of src/index.js or src/index.ts

To experiment with formatting, please run "npm run docs" from the root of this
repo and examine the changes made.

-->

This module implements the [Bitswap protocol](https://docs.ipfs.tech/concepts/bitswap/) in TypeScript.

It supersedes the older [ipfs-bitswap](https://www.npmjs.com/package/ipfs-bitswap) module with the aim of being smaller, faster, better integrated with libp2p/helia, having fewer dependencies and using standard JavaScript instead of Node.js APIs.

# Install

```console
$ npm i @helia/bitswap
```

## Browser `<script>` tag

Loading this module through a script tag will make its exports available as `HeliaBitswap` in the global namespace.

```html
<script src="https://unpkg.com/@helia/bitswap/dist/index.min.js"></script>
```

# API Docs

- <https://ipfs.github.io/helia/modules/_helia_bitswap.html>

# License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](https://github.com/ipfs/helia/blob/main/packages/bitswap/LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](https://github.com/ipfs/helia/blob/main/packages/bitswap/LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

# Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
