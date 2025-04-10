# addDir Benchmark

Benchmarks Helia addDir performance against js-ipfs and Kubo

- adds 3 separate directories: /src, /dist, /../gc/src
- saves the final CID for each added directory to ensure the CID constructed is the same
- re-instantiates a new instance for each test
- completely removes all files created in repoPath after each test
- disables pinning when using js-ipfs and kubo (it's usually enabled by default)

All three implementations use on-disk block/datastores to ensure a reasonable basis for comparison.

Warning! It can take a long time to run against folders with a very large number of files - on the order of a whole day.

Example, running against `/node_modules` takes Helia 13 minutes for a single run.

To run:

1. Add `benchmarks/*` to the `workspaces` entry in the root `package.json` of this repo
2. Run
    ```console
    $ npm run reset
    $ npm i
    $ npm run build
    $ cd benchmarks/add-dir
    $ npm start

    > benchmarks-gc@1.0.0 start
    > npm run build && node dist/src/index.js


    > benchmarks-gc@1.0.0 build
    > aegir build --bundle false

    [14:51:28] tsc [started]
    [14:51:33] tsc [completed]
    generating Ed25519 keypair...
    ┌─────────┬─────────────────────┬─────────┬───────────┬──────┬───────────┬───────────┐
    │ (index) │   Implementation    │  ops/s  │   ms/op   │ runs │    p99    │    CID    │
    ├─────────┼─────────────────────┼─────────┼───────────┼──────┼───────────┼───────────┤
    //... results here
    ```

## Things to improve

- [ ] Process hangs sometimes (hanging promises not resolving...?). Temporarily fixed with `process.exit(0)` after test results are output
- [ ] Cannot test using `TEST_PATH=node_modules` yet (test takes roughly 13 minutes for a single run, even when running only helia and altering fileImport and blockWrite concurrency)
- [ ] Instead of tearing down the entire instance of each implementation, we may want to simply delete the entries in the blockstore (i.e. afterEach: cleanBlockstore())
- [ ] we should be able to generate a set of files/folders with a specific count, and total size, that we can run these tests against. (using https://github.com/jbenet/go-random-files ?)
- [ ] we should add an implementation where we execute kubo directly instead of through ipfsd-ctl

## Changing the benchmark

You can set environment variables to change how the benchmark is ran

### ITERATIONS

Change the number of iterations that are ran
```bash
ITERATIONS=1 npm start

> benchmarks-add-dir@1.0.0 start
> npm run build && node dist/src/index.js


> benchmarks-add-dir@1.0.0 build
> aegir build --bundle false

[13:00:02] tsc [started]
[13:00:03] tsc [completed]
generating Ed25519 keypair...
(node:12805) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
generating Ed25519 keypair...
generating Ed25519 keypair...
┌─────────┬───────────────────────────┬──────────┬──────────┬──────┬───────────┬───────────┐
│ (index) │      Implementation       │  ops/s   │  ms/op   │ runs │    p99    │    CID    │
├─────────┼───────────────────────────┼──────────┼──────────┼──────┼───────────┼───────────┤
│    0    │     'helia-fs - src'      │ '438.44' │  '2.28'  │ 439  │  '3.97'   │ 'bafyfoo' │
│    1    │     'helia-fs - dist'     │ '81.62'  │ '12.25'  │  82  │ '316.61'  │ 'bafyfoo' │
│    2    │  'helia-fs - ../gc/src'   │ '475.87' │  '2.10'  │ 476  │  '5.59'   │ 'bafyfoo' │
│    3    │     'helia-mem - src'     │ '924.29' │  '1.08'  │ 925  │  '2.08'   │ 'bafyfoo' │
│    4    │    'helia-mem - dist'     │ '242.95' │  '4.12'  │ 243  │  '5.92'   │ 'bafyfoo' │
│    5    │  'helia-mem - ../gc/src'  │ '901.17' │  '1.11'  │ 902  │  '2.70'   │ 'bafyfoo' │
│    6    │       'ipfs - src'        │ '11.60'  │ '86.22'  │  12  │ '103.93'  │ 'bafyfoo' │
│    7    │       'ipfs - dist'       │  '2.29'  │ '436.19' │  5   │ '456.56'  │ 'bafyfoo' │
│    8    │    'ipfs - ../gc/src'     │  '6.11'  │ '163.68' │  7   │ '181.44'  │ 'bafyfoo' │
│    9    │       'kubo - src'        │ '13.78'  │ '72.56'  │  14  │ '248.15'  │ 'bafyfoo' │
│   10    │       'kubo - dist'       │  '2.50'  │ '400.71' │  5   │ '1208.74' │ 'bafyfoo' │
│   11    │    'kubo - ../gc/src'     │ '11.79'  │ '84.79'  │  12  │ '433.94'  │ 'bafyfoo' │
│   12    │    'kubo-direct - src'    │ '14.68'  │ '68.13'  │  15  │ '240.11'  │ 'bafyfoo' │
│   13    │   'kubo-direct - dist'    │  '2.48'  │ '403.53' │  5   │ '1232.42' │ 'bafyfoo' │
│   14    │ 'kubo-direct - ../gc/src' │ '13.89'  │ '71.99'  │  14  │ '329.82'  │ 'bafyfoo' │
└─────────┴───────────────────────────┴──────────┴──────────┴──────┴───────────┴───────────┘
```

### MIN_TIME

Change how long we want to allow the test to run, running as many iterations as possible
```bash
MIN_TIME=1000 npm start

> benchmarks-add-dir@1.0.0 start
> npm run build && node dist/src/index.js


> benchmarks-add-dir@1.0.0 build
> aegir build --bundle false

[13:00:38] tsc [started]
[13:00:39] tsc [completed]
generating Ed25519 keypair...
(node:13367) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
generating Ed25519 keypair...
generating Ed25519 keypair...
┌─────────┬─────────────────────┬──────────┬──────────┬──────┬───────────┬───────────┐
│ (index) │   Implementation    │  ops/s   │  ms/op   │ runs │    p99    │    CID    │
├─────────┼─────────────────────┼──────────┼──────────┼──────┼───────────┼───────────┤
│    0    │    'helia - src'    │ '516.16' │  '1.94'  │ 517  │  '3.47'   │ 'bafyfoo' │
│    1    │   'helia - dist'    │ '126.64' │  '7.90'  │ 127  │  '13.49'  │ 'bafyfoo' │
│    2    │ 'helia - ../gc/src' │ '502.72' │  '1.99'  │ 503  │  '3.66'   │ 'bafyfoo' │
│    3    │    'ipfs - src'     │ '13.12'  │ '76.22'  │  14  │  '99.63'  │ 'bafyfoo' │
│    4    │    'ipfs - dist'    │  '2.84'  │ '352.04' │  5   │ '418.21'  │ 'bafyfoo' │
│    5    │ 'ipfs - ../gc/src'  │  '5.39'  │ '185.56' │  6   │ '217.48'  │ 'bafyfoo' │
│    6    │    'kubo - src'     │ '17.47'  │ '57.23'  │  18  │ '208.40'  │ 'bafyfoo' │
│    7    │    'kubo - dist'    │  '3.04'  │ '328.87' │  5   │ '1038.24' │ 'bafyfoo' │
│    8    │ 'kubo - ../gc/src'  │ '12.88'  │ '77.65'  │  13  │ '328.25'  │ 'bafyfoo' │
└─────────┴─────────────────────┴──────────┴──────────┴──────┴───────────┴───────────┘
```

### TEST_PATH
Test different paths

```bash
TEST_PATH=../../node_modules/neo-async npm start

> benchmarks-add-dir@1.0.0 start
> npm run build && node dist/src/index.js


> benchmarks-add-dir@1.0.0 build
> aegir build --bundle false

[13:31:27] tsc [started]
[13:31:28] tsc [completed]
generating Ed25519 keypair...
(node:34722) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
┌─────────┬──────────────────────────────────────────────┬─────────┬───────────┬──────┬───────────┬───────────┐
│ (index) │                Implementation                │  ops/s  │   ms/op   │ runs │    p99    │    CID    │
├─────────┼──────────────────────────────────────────────┼─────────┼───────────┼──────┼───────────┼───────────┤
│    0    │  'helia-fs - ../../node_modules/neo-async'   │ '2.01'  │ '498.48'  │  5   │ '2190.31' │ 'bafyfoo' │
│    1    │  'helia-mem - ../../node_modules/neo-async'  │ '19.22' │  '52.04'  │  5   │  '85.31'  │ 'bafyfoo' │
│    2    │    'ipfs - ../../node_modules/neo-async'     │ '0.20'  │ '4895.68' │  5   │ '5209.99' │ 'bafyfoo' │
│    3    │    'kubo - ../../node_modules/neo-async'     │ '0.38'  │ '2641.59' │  5   │ '7776.20' │ 'bafyfoo' │
│    4    │ 'kubo-direct - ../../node_modules/neo-async' │ '0.43'  │ '2348.51' │  5   │ '7149.77' │ 'bafyfoo' │
└─────────┴──────────────────────────────────────────────┴─────────┴───────────┴──────┴───────────┴───────────┘
```

```bash
TEST_PATH=../../node_modules/ipfs-core/node_modules npm start

> benchmarks-add-dir@1.0.0 start
> npm run build && node dist/src/index.js


> benchmarks-add-dir@1.0.0 build
> aegir build --bundle false

[14:17:29] tsc [started]
[14:17:30] tsc [completed]
generating Ed25519 keypair...
(node:65964) ExperimentalWarning: The Fetch API is an experimental feature. This feature could change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
generating Ed25519 keypair...
generating Ed25519 keypair...
┌─────────┬───────────────────────────────────────────────────────────┬────────┬─────────────┬──────┬─────────────┬───────────┐
│ (index) │                      Implementation                       │ ops/s  │    ms/op    │ runs │     p99     │    CID    │
├─────────┼───────────────────────────────────────────────────────────┼────────┼─────────────┼──────┼─────────────┼───────────┤
│    0    │    'helia - ../../node_modules/ipfs-core/node_modules'    │ '0.15' │  '6708.96'  │  5   │ '29599.11'  │ 'bafyfoo' │
│    1    │    'ipfs - ../../node_modules/ipfs-core/node_modules'     │ '0.00' │ '228866.62' │  5   │ '237419.96' │ 'bafyfoo' │
│    2    │    'kubo - ../../node_modules/ipfs-core/node_modules'     │ '0.00' │ '230310.82' │  5   │ '234432.20' │ 'bafyfoo' │
│    3    │ 'kubo-direct - ../../node_modules/ipfs-core/node_modules' │ '0.00' │ '205561.86' │  5   │ '219400.15' │ 'bafyfoo' │
└─────────┴───────────────────────────────────────────────────────────┴────────┴─────────────┴──────┴─────────────┴───────────┘
```

## Troubleshooting

You can enable debug logging by setting `DEBUG=bench:add-dir*`
