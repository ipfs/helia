# Transfer Benchmark

Benchmarks Helia transfer performance against Kubo

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

Recently generated graphs:

- Lower numbers are better
- The legend arrow indicates direction of transfer
  - e.g. `helia -> kubo` is the equivalent of
    1. `ipfs.add` executed on Helia
    2. `ipfs.cat` executed on Kubo which pulls the data from Helia

<img width="595" alt="image" src="https://github.com/ipfs/helia/assets/665810/302c9d42-8979-4cca-a7e7-13ee6fe083fa">

<img width="594" alt="image" src="https://github.com/ipfs/helia/assets/665810/9b25abfe-2cf2-4c5e-89a1-6b1817dee722">
