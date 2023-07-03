# Transfer Benchmark

Benchmarks Helia transfer performance against js-ipfs and Kubo

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json` of this repo
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/transfer
    $ npm start

    > benchmarks-gc@1.0.0 start
    > npm run build && node dist/src/index.js


    > benchmarks-transfer@1.0.0 build
    > aegir build --bundle false

    [14:51:28] tsc [started]
    [14:51:33] tsc [completed]
    generating Ed25519 keypair...
    ┌─────────┬────────────────┬─────────┬───────────┬──────┐
    │ (index) │ Implementation │  ops/s  │   ms/op   │ runs │
    ├─────────┼────────────────┼─────────┼───────────┼──────┤
    //... results here
    ```
