/* eslint-env mocha */

import { expect } from "aegir/chai";
import { Key } from "interface-datastore";
import { CID } from "multiformats/cid";
import { createHeliaHTTP } from "../src/index.js";
import type { Helia } from "@helia/interface";

describe("helia factory", () => {
  let heliaHTTP: Helia;

  afterEach(async () => {
    if (heliaHTTP != null) {
      await heliaHTTP.stop();
    }
  });

  it("does not require any constructor args", async () => {
    heliaHTTP = await createHeliaHTTP();

    const cid = CID.parse("QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F");
    const block = Uint8Array.from([0, 1, 2, 3]);

    await heliaHTTP.blockstore.put(cid, block);
    const blockIsStored = await heliaHTTP.blockstore.has(cid);

    const key = new Key(`/${cid.toString()}`);
    await heliaHTTP.datastore.put(key, block);
    const dataIsStored = await heliaHTTP.datastore.has(key);

    expect(blockIsStored).to.be.true();
    expect(dataIsStored).to.be.true();
  });
});
