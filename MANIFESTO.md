# Manifesto <!-- omit in toc -->

Helia aims to be a next generation IPFS implementation that takes the learnings of [js-ipfs] and applies them to a modern, modular, and efficient codebase.

## Table of Contents <!-- omit in toc -->

- [Modular](#modular)
- [BYO Filesystem](#byo-filesystem)
- [JavaScript first](#javascript-first)
  - [(runtime-specific code where it makes sense)](#runtime-specific-code-where-it-makes-sense)
- [Permissions](#permissions)
- [ESM and TypeScript](#esm-and-typescript)
- [Non-goals](#non-goals)
  - [Networking](#networking)

## Modular

The use cases for a distributed filesystem are incredibly far reaching and the "bundle-everything" approach of `js-ipfs`/`kubo` does not suit every application.

For example:

- Applications deployed to browsers may wish to limit the size of the final bundle by omitting features
- Others run in extremely adversarial environments often wish to limit the number of dependencies in the tree to limit the possibility of supply chain effects
- The user should not have to include the code for features their application does not use

The core of Helia will be very basic, targetting use as a library - just [js-libp2p], a [blockstore], [js-bitswap] and a posix-like API which will be extendable to add additional features such as IPNS, an RPC-API, etc.

A "get you started" bundle with some common components will be provided but users are very much encouraged to roll their own version of Helia to suit their use case.

## BYO Filesystem

The default filesystem for IPFS is [UnixFS](https://github.com/ipfs/specs/blob/main/UNIXFS.md), but UnixFS has several limitations.  Support for some common unix file attributes such as mode and mtime landed in 1.5 but this has yet to make it to [kubo].

Several features are still missing such as arbitrary metadata or versioning, but they have been implemented by other filesystems such as [WNFS](https://guide.fission.codes/developers/webnative/file-system-wnfs).

That these missing features are being implemented by other filesystems is incredibly exciting and will unlock new use cases that are not possible today, so Helia will not bless any one filesystem as the One True Implementation, instead it will present an abstraction of posix filesystem operations (`ls`, `cat`, etc) as an API but the underlying filesystem(s) will be configurable.

## JavaScript first

In the beginning there were node [streams](https://nodejs.org/api/stream.html#readable-streams), then there were [pull streams](https://www.npmjs.com/package/pull-stream), and finally browsers have [native streams too](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream).

Similarly [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget)s can be used where [EventEmitter](https://nodejs.org/api/events.html#class-eventemitter) were previously.

There are many other cases where primitives that existed only in node or were provided by a popular library have now made it in to the language itself - these constructs should be used in preference to userland modules to remove dependencies and make the API types more idiomatic and recognisable as modern JavaScript.

This also makes it easier to support other runtimes like [deno](https://deno.land/) or [bun](https://bun.sh/) since runtime-specific code should be behind configuration such as the `"browser"` or `"exports"` fields in the `package.json`.

### (runtime-specific code where it makes sense)

Some things are just faster in Node.js. The ability to run native code should not be underestimated so where the JS implementation of an algorithm is a proven performance bottleneck and a native version exists, it should be used.

## Permissions

`js-ipfs` has no concept of permissions so all capabilities are available to every user. This has caused lots of problems with the HTTP-RPC-API in particular and lead to hastily implemented attempts to lock access down like limiting HTTP verbs or detecting user agents.

Helia will integrate permissions at it's core, also allowing delegation of permissions via mechanisms such as [UCAN](https://ucan.xyz/)s.

## ESM and TypeScript

Trying to write applications that scale has always been a challenge for JavaScript. Tools like TypeScript ease some of this pain so Helia will be full TypeScript and published as ESM-only to take advantage of modern runtimes and tooling.

## Non-goals

Helia is not attempting to reinvent the wheel when it comes to layers beneath the top-level API.

### Networking

It will use [js-libp2p] and [js-bitswap] to ensure compatibility with existing IPFS clients.

[js-ipfs]: https://github.com/ipfs/js-ipfs
[js-libp2p]: https://github.com/libp2p/js-libp2p
[js-bitswap]: https://github.com/ipfs/js-ipfs-bitswap
[blockstore]: https://github.com/ipfs/js-ipfs-interfaces/tree/master/packages/interface-blockstore
[kubo]: https://github.com/ipfs/kubo