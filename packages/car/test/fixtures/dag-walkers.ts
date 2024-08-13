import * as dagPb from "@ipld/dag-pb";
import * as raw from "multiformats/codecs/raw";
import type { DAGWalker } from "@helia/interface";

/**
 * Dag walker for dag-pb CIDs
 */
const dagPbWalker: DAGWalker = {
  codec: dagPb.code,
  *walk(block) {
    const node = dagPb.decode(block);

    yield* node.Links.map((l) => l.Hash);
  },
};

const rawWalker: DAGWalker = {
  codec: raw.code,
  *walk() {
    // no embedded CIDs in a raw block
  },
};

export const dagWalkers = {
  [dagPb.code]: dagPbWalker,
  [raw.code]: rawWalker,
};
