# Transport Benchmark

Benchmarks Helia transport performance against each other

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json` of this repo
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/transport
    $ npm start

    > benchmarks-transports@1.0.0 start
    > npm run build && node dist/src/index.js


    > benchmarks-transports@1.0.0 build
    > aegir build --bundle false

    [14:51:28] tsc [started]
    [14:51:33] tsc [completed]

    //... results here
    ```

## Debugging

To get debug output, run with `DEBUG=test*`, e.g.:

```console
$ DEBUG=test* npm start
```
