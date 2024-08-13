import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bitswap } from "@helia/block-brokers";
import { libp2pRouting } from "@helia/routers";
import { identify } from "@libp2p/identify";
import { prefixLogger } from "@libp2p/logger";
import { createHelia, type HeliaLibp2p } from "helia";
import { createLibp2p } from "libp2p";
import { getStores } from "./stores.js";
import { getTransports } from "./transports.js";
import type { Libp2p } from "@libp2p/interface";

export async function getHelia(): Promise<HeliaLibp2p<Libp2p<any>>> {
  const listen = `${process.env.HELIA_LISTEN ?? ""}`.split(",").filter(Boolean);
  const { datastore, blockstore } = await getStores();
  const logger = prefixLogger(`${process.env.HELIA_TYPE}`);

  const libp2p = await createLibp2p({
    logger,
    addresses: {
      listen,
    },
    transports: getTransports(),
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
    },
    connectionManager: {
      minConnections: 0,
    },
    connectionGater: {
      denyDialMultiaddr: async () => false,
    },
    datastore,
  });

  return createHelia({
    logger,
    blockstore,
    datastore,
    blockBrokers: [bitswap()],
    routers: [libp2pRouting(libp2p)],
    libp2p,
  });
}
