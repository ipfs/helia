# 🙋 FAQ <!-- omit in toc -->

> Please open an issue if you'd like something addressed here

## Table of contents <!-- omit in toc -->

- [👩‍👧 What is the relationship of Helia to js-ipfs?](#-what-is-the-relationship-of-helia-to-js-ipfs)
- [🤝 How does Helia guarantee compatibility with Kubo and other IPFS implementations?](#-how-does-helia-guarantee-compatibility-with-kubo-and-other-ipfs-implementations)
- [🏎️ How does it perform compared to other implementations including js-ipfs?](#️-how-does-it-perform-compared-to-other-implementations-including-js-ipfs)
  - [Garbage collection](#garbage-collection)

### 👩‍👧 What is the relationship of Helia to js-ipfs?

[IPFS] is a set of protocols that define a way to implement a distributed file system. Historically it's also been the name of two applications that implement those protocols in Go ([Kubo]) and JavaScript ([js-ipfs]).

With [Filecoin] development, [Protocol Labs] found that progress towards the goal of "one protocol multiple implementations" was smoother when implementations did not contain the word "Filecoin" as by including that term, people consciously or unconsciously assume that one project is somehow "blessed", favoured or otherwise more important than another.

So in [late 2021](https://github.com/ipfs/ipfs/issues/470) a plan was enacted to remove the word "IPFS" from go-ipfs and js-ipfs and free up the space for multiple alternative implementations, which would be free to innovate on their own terms and perhaps specialize for certain tasks or environments.

go-ipfs was renamed [Kubo] and carried on as usual, but for js-ipfs we wanted to take the opportunity to have another look at what an implementation of IPFS in JS could look like and to apply learnings from the previous years of development.

The result of this is Helia - a new implementation of IPFS in JavaScript that is designed to be more modular and lightweight than js-ipfs which focusses on the most important use cases of IPFS in JavaScript.

It shares some internal components with js-ipfs - [libp2p], [bitswap] etc but has a [redesigned API](https://ipfs.github.io/helia/interfaces/_helia_interface.Helia.html) that will enable the next generation of distributed applications.

js-ipfs is being retired in favour of Helia - read more about the [thought processes](./MANIFESTO.md) that informed the design, check out the [examples](https://github.com/ipfs-examples/helia-examples) and start porting your application today!

### 🤝 How does Helia guarantee compatibility with Kubo and other IPFS implementations?

Each Helia component has an interop suite that tests compatibility with other IPFS implementations.

See:

* [helia interop](./packages/interop)
* [@helia/ipns interop](https://github.com/ipfs/helia-ipns/tree/main/packages/interop)
* [@helia/unixfs interop](https://github.com/ipfs/helia-unixfs/tree/main/packages/interop)

Other modules should implement an interop suite which can be linked to from here.

### 🏎️ How does it perform compared to other implementations including js-ipfs?

For the areas that have been benchmarked, very favourably.

There is a [benchmarking suite](./benchmarks) in this repository which will be extended to cover most functional areas.

#### Garbage collection

Helia uses reference counting for garbage collection, this has proven to be much more scalable than the approaches taken by js-ipfs or Kubo.

Please see [#36](https://github.com/ipfs/helia/pull/36#issuecomment-1441403221) for graphs and discussion of the results.

[ipfs]: https://ipfs.io
[js-ipfs]: https://github.com/ipfs/js-ipfs
[kubo]: https://github.com/ipfs/kubo
[filecoin]: https://filecoin.io
[Protocol Labs]: https://protocol.ai
[libp2p]: https://github.com/libp2p/js-libp2p
[bitswap]: https://github.com/ipfs/js-ipfs-bitswap
