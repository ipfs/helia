import { FsBlockstore } from "blockstore-fs";
import { LevelDatastore } from "datastore-level";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";

export async function getStores(): Promise<{
  blockstore: Blockstore;
  datastore: Datastore;
}> {
  return {
    blockstore: new FsBlockstore(`${process.env.HELIA_REPO}/blocks`),
    datastore: new LevelDatastore(`${process.env.HELIA_REPO}/data`),
  };
}
