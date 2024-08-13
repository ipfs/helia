/* eslint-env mocha */

import { expect } from "aegir/chai";
import { MemoryBlockstore } from "blockstore-core";
import { type UnixFS, unixfs } from "../src/index.js";
import { createShardedDirectory } from "./fixtures/create-sharded-directory.js";
import { smallFile } from "./fixtures/files.js";
import type { Blockstore } from "interface-blockstore";
import type { CID } from "multiformats/cid";

describe("chmod", () => {
  let blockstore: Blockstore;
  let fs: UnixFS;
  let emptyDirCid: CID;

  beforeEach(async () => {
    blockstore = new MemoryBlockstore();

    fs = unixfs({ blockstore });

    emptyDirCid = await fs.addDirectory();
  });

  it("should update the mode for a raw node", async () => {
    const cid = await fs.addBytes(smallFile);
    const originalMode = (await fs.stat(cid)).mode;
    const updatedCid = await fs.chmod(cid, 0o777);

    const updatedMode = (await fs.stat(updatedCid)).mode;
    expect(updatedMode).to.not.equal(originalMode);
    expect(updatedMode).to.equal(0o777);
  });

  it("should update the mode for a file", async () => {
    const cid = await fs.addBytes(smallFile, {
      rawLeaves: false,
    });
    const originalMode = (await fs.stat(cid)).mode;
    const updatedCid = await fs.chmod(cid, 0o777);

    const updatedMode = (await fs.stat(updatedCid)).mode;
    expect(updatedMode).to.not.equal(originalMode);
    expect(updatedMode).to.equal(0o777);
  });

  it("should update the mode for a directory", async () => {
    const path = `foo-${Math.random()}`;

    const dirCid = await fs.mkdir(emptyDirCid, path);
    const originalMode = (
      await fs.stat(dirCid, {
        path,
      })
    ).mode;
    const updatedCid = await fs.chmod(dirCid, 0o777, {
      path,
    });

    const updatedMode = (
      await fs.stat(updatedCid, {
        path,
      })
    ).mode;
    expect(updatedMode).to.not.equal(originalMode);
    expect(updatedMode).to.equal(0o777);
  });

  it("should update mode recursively", async () => {
    const path = "path";
    const cid = await fs.addBytes(smallFile);
    const dirCid = await fs.cp(cid, emptyDirCid, path);
    const originalMode = (
      await fs.stat(dirCid, {
        path,
      })
    ).mode;
    const updatedCid = await fs.chmod(dirCid, 0o777, {
      recursive: true,
    });

    const updatedMode = (
      await fs.stat(updatedCid, {
        path,
      })
    ).mode;
    expect(updatedMode).to.not.equal(originalMode);
    expect(updatedMode).to.equal(0o777);
  });

  it("should update the mode for a hamt-sharded-directory", async () => {
    const shardedDirCid = await createShardedDirectory(blockstore);

    const originalMode = (await fs.stat(shardedDirCid)).mode;
    const updatedShardCid = await fs.chmod(shardedDirCid, 0o777);

    const updatedMode = (await fs.stat(updatedShardCid)).mode;
    expect(updatedMode).to.not.equal(originalMode);
    expect(updatedMode).to.equal(0o777);
  });

  it("refuses to chmod missing blocks", async () => {
    const cid = await fs.addBytes(smallFile);

    await blockstore.delete(cid);
    expect(blockstore.has(cid)).to.be.false();

    await expect(
      fs.chmod(cid, 0o777, {
        offline: true,
      }),
    ).to.eventually.be.rejected.with.property("code", "ERR_NOT_FOUND");
  });
});
