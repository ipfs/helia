# Transport Benchmark

Benchmarks Helia transport performance against each other

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json` of this repo
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/transports
    $ npm start

    > benchmarks-transports@1.0.0 start
    > npm run build && node dist/src/index.js


    > benchmarks-transports@1.0.0 build
    > aegir build --bundle false

    [14:51:28] tsc [started]
    [14:51:33] tsc [completed]

    Implementation, 105 MB, 210 MB, 315 MB, 419 MB, 524 MB, 629 MB, 734 MB, 839 MB, 944 MB, 1.05 GB
    TCP (node.js -> node.js) filecoin defaults, 775, 1763, 2104, 3254, 3881, 4384, 5904, 5161, 6382, 6856
    WebSockets (node.js -> node.js) filecoin defaults, 1068, 1642, 2092, 2812, 4117, 4423, 6117, 7820, 7182, 7816
    //... results here
    ```
3. Graph the CSV data with your favourite graphing tool

## Debugging

To get debug output, run with the `DEBUG` env var set to `test*` to see all output, `recipient*` to just see the recipient's log, `sender=*` to see the sender's log, etc.

Eg.

```console
$ DEBUG=test* npm start
```

or

```console
$ DEBUG='test*,sender*' npm start
```

## Results

Recently generated graph:

- Lower numbers are better
- The legend arrow indicates direction of transfer
    - e.g. `helia -> kubo` is the equivalent of
      1. `ipfs.add` executed on Helia
      2. `ipfs.pin` executed on Kubo which pulls the data from Helia

<img width="1042" alt="image" src="https://github.com/ipfs/helia/assets/665810/d0d16ed0-d764-42ee-be73-ac7bbb938103">
