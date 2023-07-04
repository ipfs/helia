# GC Benchmark

Benchmarks Helia GC performance against js-ipfs and Kubo

- Removes any existing pins
- Creates 10000 DAGs with two nodes linked to by a root node that is pinned
- Creates 10000 unpinned blocks
- Runs GC to delete the unpinned blocks leaving the others intact

All three implementations use on-disk block/datastores to ensure a reasonable basis for comparison.

Warning! It can take a long time with realistic pinset sizes - on the order of a whole day.

You can speed things up by removing js-ipfs from the `impls` array.

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json` of this repo
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/gc
    $ npm start

    > benchmarks-gc@1.0.0 start
    > npm run build && node dist/src/index.js


    > benchmarks-gc@1.0.0 build
    > aegir build --bundle false

    [14:51:28] tsc [started]
    [14:51:33] tsc [completed]
    generating Ed25519 keypair...
    ┌─────────┬────────────────┬─────────┬───────────┬──────┐
    │ (index) │ Implementation │  ops/s  │   ms/op   │ runs │
    ├─────────┼────────────────┼─────────┼───────────┼──────┤
    //... results here
    ```

## Graph

To output stats for a graph run:

```console
$ npm run build && node dist/src/graph.js
```
