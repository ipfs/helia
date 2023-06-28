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

You can speed things up by removing js-ipfs from the `impls` array.

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
    ┌─────────┬─────────────────────┬─────────┬───────────┬──────┬───────────┬───────────────────────────────────────────────────────────────┐
    │ (index) │   Implementation    │  ops/s  │   ms/op   │ runs │    p99    │                              CID                              │
    ├─────────┼─────────────────────┼─────────┼───────────┼──────┼───────────┼───────────────────────────────────────────────────────────────┤
    //... results here
    ```

## Things to improve

- [ ] Process hangs sometimes (hanging promises not resolving...?). Temporarily fixed with `process.exit(0)` after test results are output
- [ ] The Helia test is generating a different CID than js-ipfs & Kubo. This is expected because defaults configured are different, but for accurate comparisons, we should ensure the same structure is generated.
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
┌─────────┬─────────────────────┬─────────┬───────────┬──────┬───────────┬───────────────────────────────────────────────────────────────┐
│ (index) │   Implementation    │  ops/s  │   ms/op   │ runs │    p99    │                              CID                              │
├─────────┼─────────────────────┼─────────┼───────────┼──────┼───────────┼───────────────────────────────────────────────────────────────┤
│    0    │    'helia - src'    │ '13.70' │  '73.00'  │  1   │  '73.00'  │ 'bafybeibb3ofn76feg2555mawvjceo5otfzkmt6xhckpdtdyiwsxnhq5b6y' │
│    1    │   'helia - dist'    │ '3.37'  │ '297.09'  │  1   │ '297.09'  │ 'bafybeiewlvh72zaaoxhxdajauozve5npi5kwryv4sj2ixayqhu4zgdd2nu' │
│    2    │ 'helia - ../gc/src' │ '9.98'  │ '100.18'  │  1   │ '100.18'  │ 'bafybeihhyvzl4zqbvvtafd6cnp37gwvrypn2cxpyr2yj5zppvgk3urxgpm' │
│    3    │    'ipfs - src'     │ '10.24' │  '97.61'  │  1   │  '97.61'  │ 'bafybeigmzp4tpf6ieqrbe2lkutkd52kfeh7nlmivlfzsqtzootlbgond5i' │
│    4    │    'ipfs - dist'    │ '3.26'  │ '306.56'  │  1   │ '306.56'  │ 'bafybeiapdyhejcw6sd7f5bayzpp5in3rx44lu3rbpvl2opjgc2msevfsoe' │
│    5    │ 'ipfs - ../gc/src'  │ '7.16'  │ '139.60'  │  1   │ '139.60'  │ 'bafybeibdpig6o56rjems2twzgvog7ssatt5szrpnjgvtnws4i4bm5csvoa' │
│    6    │    'kubo - src'     │ '4.64'  │ '215.45'  │  1   │ '215.45'  │ 'bafybeigmzp4tpf6ieqrbe2lkutkd52kfeh7nlmivlfzsqtzootlbgond5i' │
│    7    │    'kubo - dist'    │ '0.92'  │ '1090.13' │  1   │ '1090.13' │ 'bafybeiapdyhejcw6sd7f5bayzpp5in3rx44lu3rbpvl2opjgc2msevfsoe' │
│    8    │ 'kubo - ../gc/src'  │ '2.21'  │ '452.36'  │  1   │ '452.36'  │ 'bafybeifqlusi6zeboi7mxdbbjr5y5pdojrohhtelm4rbhb2vfkfa6f2kfu' │
└─────────┴─────────────────────┴─────────┴───────────┴──────┴───────────┴───────────────────────────────────────────────────────────────┘
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
┌─────────┬─────────────────────┬──────────┬──────────┬──────┬───────────┬───────────────────────────────────────────────────────────────┐
│ (index) │   Implementation    │  ops/s   │  ms/op   │ runs │    p99    │                              CID                              │
├─────────┼─────────────────────┼──────────┼──────────┼──────┼───────────┼───────────────────────────────────────────────────────────────┤
│    0    │    'helia - src'    │ '516.16' │  '1.94'  │ 517  │  '3.47'   │ 'bafybeievc57xgecd6icfsrp2v4t2a5fepicezabwcvh7javhx7gr7zkbnu' │
│    1    │   'helia - dist'    │ '126.64' │  '7.90'  │ 127  │  '13.49'  │ 'bafybeiewlvh72zaaoxhxdajauozve5npi5kwryv4sj2ixayqhu4zgdd2nu' │
│    2    │ 'helia - ../gc/src' │ '502.72' │  '1.99'  │ 503  │  '3.66'   │ 'bafybeihhyvzl4zqbvvtafd6cnp37gwvrypn2cxpyr2yj5zppvgk3urxgpm' │
│    3    │    'ipfs - src'     │ '13.12'  │ '76.22'  │  14  │  '99.63'  │ 'bafybeic7zx457hr3s2z7n3rnl3nckwjo3nhlpex7kmzxw7tzv3y5fbyki4' │
│    4    │    'ipfs - dist'    │  '2.84'  │ '352.04' │  5   │ '418.21'  │ 'bafybeiapdyhejcw6sd7f5bayzpp5in3rx44lu3rbpvl2opjgc2msevfsoe' │
│    5    │ 'ipfs - ../gc/src'  │  '5.39'  │ '185.56' │  6   │ '217.48'  │ 'bafybeibdpig6o56rjems2twzgvog7ssatt5szrpnjgvtnws4i4bm5csvoa' │
│    6    │    'kubo - src'     │ '17.47'  │ '57.23'  │  18  │ '208.40'  │ 'bafybeic7zx457hr3s2z7n3rnl3nckwjo3nhlpex7kmzxw7tzv3y5fbyki4' │
│    7    │    'kubo - dist'    │  '3.04'  │ '328.87' │  5   │ '1038.24' │ 'bafybeiapdyhejcw6sd7f5bayzpp5in3rx44lu3rbpvl2opjgc2msevfsoe' │
│    8    │ 'kubo - ../gc/src'  │ '12.88'  │ '77.65'  │  13  │ '328.25'  │ 'bafybeifqlusi6zeboi7mxdbbjr5y5pdojrohhtelm4rbhb2vfkfa6f2kfu' │
└─────────┴─────────────────────┴──────────┴──────────┴──────┴───────────┴───────────────────────────────────────────────────────────────┘
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
┌─────────┬────────────────────────────────────────┬────────┬───────────┬──────┬───────────┬───────────────────────────────────────────────────────────────┐
│ (index) │             Implementation             │ ops/s  │   ms/op   │ runs │    p99    │                              CID                              │
├─────────┼────────────────────────────────────────┼────────┼───────────┼──────┼───────────┼───────────────────────────────────────────────────────────────┤
│    0    │ 'helia - ../../node_modules/neo-async' │ '2.46' │ '406.30'  │  5   │ '1740.40' │ 'bafybeib5nofkubfon4upbeqvtn224uajsauqlkvlrik5p4xo53ws7e24sm' │
│    1    │ 'ipfs - ../../node_modules/neo-async'  │ '0.21' │ '4651.38' │  5   │ '5026.16' │ 'bafybeigdyetiosfdnzg4cocoqneudndktcukaa3qdwj2ndeoxuqk6oxycm' │
│    2    │ 'kubo - ../../node_modules/neo-async'  │ '0.40' │ '2482.82' │  5   │ '7375.55' │ 'bafybeiey5wqhualgsssqo53dafzlp5fq2dzlv742raqvayougzsvbqvatm' │
└─────────┴────────────────────────────────────────┴────────┴───────────┴──────┴───────────┴───────────────────────────────────────────────────────────────┘
```

## Troubleshooting

You can enable debug logging by setting `DEBUG=bench:add-dir*`
