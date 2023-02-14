<p align="center">
  <a href="https://github.com/ipfs/helia" title="Helia">
    <img src="https://raw.githubusercontent.com/ipfs/helia/main/assets/helia.png" alt="Helia logo" width="300" />
  </a>
</p>

# @helia/ipns <!-- omit in toc -->

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia-ipns.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia-ipns)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia-ipns/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia-ipns/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

> An implementation of IPNS for Helia

## Table of contents <!-- omit in toc -->

- - [Structure](#structure)
- [helia <!-- omit in toc -->](#helia----omit-in-toc---)
  - [Project status](#project-status)
  - [Name](#name)
  - [Background](#background)
  - [Roadmap](#roadmap)
  - [API Docs](#api-docs)
  - [License](#license)
  - [Contribute](#contribute)

## Structure

- [`/packages/interop`](./packages/interop) Interop tests for @helia/ipns
- [`/packages/ipns`](./packages/ipns) An implementation of IPNS for Helia

<img src="./assets/helia.png" width="300" height="300" alt="helia logo" style="display: block; margin: auto">

# helia <!-- omit in toc -->

[![ipfs.tech](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](https://ipfs.tech)
[![Discuss](https://img.shields.io/discourse/https/discuss.ipfs.tech/posts.svg?style=flat-square)](https://discuss.ipfs.tech)
[![codecov](https://img.shields.io/codecov/c/github/ipfs/helia.svg?style=flat-square)](https://codecov.io/gh/ipfs/helia)
[![CI](https://img.shields.io/github/actions/workflow/status/ipfs/helia/js-test-and-release.yml?branch=main\&style=flat-square)](https://github.com/ipfs/helia/actions/workflows/js-test-and-release.yml?query=branch%3Amain)

## Project status

This project is pre-alpha and is currently in development. An initial v1 release is planned for [late Q1 2023](/ROADMAP.md#late-q1-march). Helia is being built in the open; community contributors are welcome!

The core of IPFS is the [Files API](https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md), which will likewise be implemented in Helia. These initial building blocks are in development now; have a look at this repo's PR(s). For more info about Helia, please see the [Roadmap](https://github.com/ipfs/helia/issues/5) and the [Manifesto](MANIFESTO.md).

We are also sharing about the progress so far, and discussing how you can get involved, at [Helia Demo Day](https://lu.ma/helia) every couple weeks. We'd love to see you there!

## Name

Helia (*HEE-lee-ah*) is the Latin spelling of Ἡλιη -- in Greek mythology, one of the [Heliades](https://www.wikidata.org/wiki/Q12656412): the daughters of the sun god Helios. When their brother Phaethon died trying to drive the sun chariot across the sky, their tears of mourning fell to earth as amber, which is yellow (sort of), and so is JavaScript. They were then turned into [poplar](https://en.wiktionary.org/wiki/poplar) trees and, well, JavaScript is quite popular.

In Oct–Dec 2022, IP Stewards [sought](https://github.com/ipfs/pomegranate/issues/3) community input for the name of this project. After considering 20 suggestions and holding a couple of polls, the name **Helia** was chosen. Here's [why it's not named IPFS](https://github.com/ipfs/ipfs/issues/470).

## Background

This project aims to build a lean, modular, and modern implementation of IPFS, the Interplanetary File System.

For more information, see the [State of IPFS in JS (blog post)](https://blog.ipfs.tech/state-of-ipfs-in-js/).

## Roadmap

Please find and comment on [the Roadmap here](https://github.com/ipfs/helia/issues/5).

This IPFS implementation in JavaScript is a work in progress. [Here are some ways you can help](https://blog.ipfs.tech/state-of-ipfs-in-js/#%F0%9F%A4%9D-ways-you-can-help)!

## API Docs

- <https://ipfs.github.io/helia-ipns>

## License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT ([LICENSE-MIT](LICENSE-MIT) / <http://opensource.org/licenses/MIT>)

## Contribute

Contributions welcome! Please check out [the issues](https://github.com/ipfs/helia-ipns/issues).

Also see our [contributing document](https://github.com/ipfs/community/blob/master/CONTRIBUTING_JS.md) for more information on how we work, and about contributing in general.

Please be aware that all interactions related to this repo are subject to the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/CONTRIBUTING.md)
