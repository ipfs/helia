/* eslint-disable no-console */

import { multiaddr } from "@multiformats/multiaddr";
import { CID } from "multiformats";
import { getKubo } from "./get-kubo.js";

process.title = `helia transport benchmark ${process.env.HELIA_TYPE}`;

const cid = CID.parse(`${process.env.HELIA_CID}`);
const mas = `${process.env.HELIA_MULTIADDRS}`
  .split(",")
  .map((str) => multiaddr(str));
const signal = AbortSignal.timeout(
  parseInt(process.env.HELIA_TIMEOUT ?? "60000"),
);

const kubo = await getKubo();

try {
  await Promise.all(
    mas.map(async (ma) =>
      kubo.api.swarm.connect(ma, {
        signal,
      }),
    ),
  );

  const start = Date.now();

  // pull data from remote. this is going over HTTP so use pin in order to ensure
  // the data is loaded by Kubo but don't skew the benchmark by then also
  // streaming it to the client
  await kubo.api.pin.add(cid, {
    recursive: true,
    signal,
  });

  console.info(`TEST-OUTPUT:${Date.now() - start}`);
} catch {
  console.info("TEST-OUTPUT:?");
}

console.info("TEST-OUTPUT:done");
