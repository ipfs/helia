# GC Benchmark

Benchmarks Helia GC performance against js-ipfs and Kubo

- Creates 100 DAGs with two nodes linked to by a root node that is pinned
- Creates 100 unpinned blocks
- Runs GC to delete the unpinned blocks leaving the others intact

All three implelmentations use on-disk block/datastores to ensure a reasonable basis for comparison.

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json`
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/gc
    $ npm start

    > benchmarks-gc@1.0.0 start
    > npm run build && node --max_old_space_size=16384 dist/src/index.js


    > benchmarks-gc@1.0.0 build
    > aegir build --bundle false

    [14:51:28] tsc [started]
    [14:51:33] tsc [completed]
    generating Ed25519 keypair...
    to get started, enter:

            jsipfs cat /ipfs/QmRaaUwTNfwgFZpeUy8qrZwrp2dY4kCKmmB5xEqvH3vtD1/readme

    helia x 0.09 ops/sec ±4.92% (5 runs sampled)
    ipfs x 0.06 ops/sec ±9.90% (5 runs sampled)
    kubo x 0.03 ops/sec ±21.27% (5 runs sampled)
    Fastest is helia
    ```

### Problems

- block/pin setup is done during the test run - this is because `benchmark.js` has no setup step that's run before every loop - consider using a different runner
- It's necessary to add the empty directory block & CID for js-ipfs, not sure why
