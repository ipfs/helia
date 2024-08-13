/* eslint-disable no-console */

import { createServer } from "ipfsd-ctl";
import { path as kuboPath } from "kubo";
import { create as kuboRpcClient } from "kubo-rpc-client";
import prettyBytes from "pretty-bytes";
import { createRelay } from "./relay.js";
import { Test } from "./test.js";
import { createTests } from "./tests.js";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { CID } from "multiformats/cid";

const ONE_MEG = 1024 * 1024;
const relay = await createRelay();

export interface TransferBenchmark {
  teardown(): Promise<void>;
  addrs(): Promise<Multiaddr[]>;
  dial(multiaddrs: Multiaddr[]): Promise<void>;
  add(content: AsyncIterable<Uint8Array>, options: ImportOptions): Promise<CID>;
  get(cid: CID): Promise<void>;
}

export interface ImportOptions {
  cidVersion?: 0 | 1;
  rawLeaves?: boolean;
  chunkSize?: number;
  maxChildrenPerNode?: number;
}

export interface File {
  name: string;
  options: ImportOptions;
  size: number;
}

const opts: Record<string, ImportOptions> = {
  "filecoin defaults": {
    chunkSize: 1024 * 1024,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 1024,
  },
};

const tests: Record<string, File[]> = {};

for (const [name, options] of Object.entries(opts)) {
  tests[name] = [];

  for (let i = 100; i < 1100; i += 100) {
    tests[name].push({
      name: `${i}`,
      options,
      size: ONE_MEG * i,
    });
  }
}

console.info(
  "Implementation,",
  tests[Object.keys(opts)[0]]
    .map((file) => prettyBytes(ONE_MEG * Number(file.name)))
    .join(", "),
);

const server = createServer(29834, {
  type: "kubo",
  test: true,
  bin: kuboPath(),
  rpc: kuboRpcClient,
  init: {
    emptyRepo: true,
  },
});

async function main(): Promise<void> {
  const impls = createTests(relay.libp2p.getMultiaddrs()[0]).map((test) => {
    return new Test(test);
  });

  for (const [name, files] of Object.entries(tests)) {
    for (const impl of impls) {
      process.stdout.write(`${impl.name} ${name}`);

      for (const file of files) {
        const time = await impl.runTest(file);
        process.stdout.write(`, ${time}`);
        await server.clean();
      }

      process.stdout.write("\n");
    }
  }

  await relay.stop();
}

main().catch((err) => {
  console.error(err); // eslint-disable-line no-console
  process.exit(1);
});
