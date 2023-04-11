# 🗣️ Manifesto <!-- omit in toc -->

Helia aims to be a next generation IPFS implementation that takes the learnings of [js-ipfs] and applies them to a modern, modular, and efficient codebase.

## Table of Contents <!-- omit in toc -->

- [🧱 Modular](#-modular)
- [📁 BYO Filesystem](#-byo-filesystem)
- [🥇 JavaScript first](#-javascript-first)
  - [🚀 (runtime-specific code where it makes sense)](#-runtime-specific-code-where-it-makes-sense)
- [📜 ESM and TypeScript](#-esm-and-typescript)
- [⛔ Non-goals](#-non-goals)
  - [🌐 Networking](#-networking)

## 🧱 Modular

The use cases for a distributed filesystem are incredibly far reaching and the "bundle-everything" approach of `js-ipfs`/`kubo` does not suit every application.

For example:

- Applications deployed to browsers may wish to limit the size of the final bundle by omitting features
- Other applications may be deployed in extremely adversarial environments, and should limit the number of dependencies (throughout the dependency tree) to reduce the opportunities for supply chain attacks
- The user should not have to include the code for features their application does not use

The core of Helia will be very focused on use as a library: just [js-libp2p], a [datastore], and a [blockstore] that transparently uses [js-bitswap] to load any requested blocks not already in the blockstore from the network and/or to transfer them to network peers.

Users are very much encouraged to bundle extra components with their version of Helia to suit their use case.

Extra components currently available are:

- [`@helia/ipns`](https://github.com/ipfs/helia-ipns) - for publishing and resolving [IPNS] names
- [`@helia/unixfs`](https://github.com/ipfs/helia-unixfs) - for performing [UnixFS] operations

We hope there will be more soon!

## 📁 BYO Filesystem

The default filesystem for IPFS is [UnixFS](https://github.com/ipfs/specs/blob/main/UNIXFS.md), but UnixFS has several limitations. Support for some common Unix file attributes such as mode (permission bits) and `mtime` landed in UnixFSv1.5, but this has yet to make it to [kubo].

Several features are still missing from 1.5, such as arbitrary metadata (extended attributes) or versioning, but they have been implemented by other filesystems such as [WNFS](https://guide.fission.codes/developers/webnative/file-system-wnfs).

That these missing features are being implemented by other filesystems is incredibly exciting and will unlock new use cases that are not possible today, so Helia will not bless any one filesystem as the One True Implementation, instead it is intended to provide the features required to implement these file systems in a network-aware way that allows pulling data from and sending data to peers.

Currently available filesystems are:

- [`@helia/unixfs`](https://github.com/ipfs/helia-unixfs) - for performing [UnixFS] operations

We hope there will be more soon!

## 🥇 JavaScript first

In the beginning there were Node.js [streams](https://nodejs.org/api/stream.html#readable-streams). Then there were [pull streams](https://www.npmjs.com/package/pull-stream). And finally, browsers have [native streams too](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream).

Similarly, [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget)s can be used where [EventEmitter](https://nodejs.org/api/events.html#class-eventemitter)s were previously.

There are many other cases where primitives that existed only in Node.js or were provided by a popular library have now made it in to the language itself. These constructs should be preferred versus userland modules, in order to remove dependencies and make the API types more idiomatic and recognizable as modern JavaScript.

This also makes it easier to support other runtimes like [deno](https://deno.land/) or [bun](https://bun.sh/) since runtime-specific code should be behind configuration such as the `"browser"` or `"exports"` fields in the `package.json`.

### 🚀 (runtime-specific code where it makes sense)

Some things are just faster in Node.js. The ability to run native code should not be underestimated so where the JS implementation of an algorithm is a proven performance bottleneck and a native version exists, it should be used.

## 📜 ESM and TypeScript

Trying to write applications that scale has always been a challenge for JavaScript. Tools like TypeScript ease some of this pain, so Helia will be written in TypeScript and published as ESM-only to take advantage of modern runtimes and tooling.

## ⛔ Non-goals

Helia is not attempting to reimplement layers beneath the top-level API so [js-libp2p] will remain as will [js-bitswap] and [js-unixfs].

### 🌐 Networking

It will use [js-libp2p] and [js-bitswap] to ensure compatibility with existing IPFS clients.

[js-ipfs]: https://github.com/ipfs/js-ipfs
[js-libp2p]: https://github.com/libp2p/js-libp2p
[js-bitswap]: https://github.com/ipfs/js-ipfs-bitswap
[blockstore]: https://github.com/ipfs/js-stores/tree/master/packages/interface-blockstore
[datastore]: https://github.com/ipfs/js-stores/tree/master/packages/interface-datastore
[kubo]: https://github.com/ipfs/kubo
[IPNS]: https://docs.ipfs.tech/concepts/ipns/
[UnixFS]: https://github.com/ipfs/specs/blob/main/UNIXFS.md
[js-unixfs]: https://github.com/ipfs/js-ipfs-unixfs