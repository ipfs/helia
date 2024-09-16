# Pinning Benchmark

Benchmarks Helia pinning performance against Kubo

- Removes any existing pins
- Creates 10000 DAGs with two nodes linked to by a root node that is pinned

All three implementations use on-disk block/datastores to ensure a reasonable basis for comparison.

Warning! It can take a long time with realistic pinset sizes - on the order of a whole day.

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json` of this repo
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/pinning
    $ npm start

    > benchmarks-pinning@1.0.0 start
    > npm run build && node dist/src/index.js


    > benchmarks-pinning@1.0.0 build
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
