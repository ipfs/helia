import { randomBytes } from "@libp2p/crypto";
import { expect } from "aegir/chai";
import all from "it-all";
import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";
import { concat as uint8ArrayConcat } from "uint8arrays/concat";
import { DEFAULT_MAX_OUTGOING_MESSAGE_SIZE } from "../../src/constants.js";
import { BitswapMessage, BlockPresenceType } from "../../src/pb/message.js";
import { QueuedBitswapMessage } from "../../src/utils/bitswap-message.js";
import { cidToPrefix } from "../../src/utils/cid-prefix.js";
import { MAX_BLOCK_SIZE, splitMessage } from "../../src/utils/split-message.js";
import type {
  Block,
  BlockPresence,
  WantlistEntry,
} from "../../src/pb/message.js";

async function createBlock(
  size = 1024,
): Promise<{ cid: CID; data: Uint8Array }> {
  const randomLength = 1024;
  const data = uint8ArrayConcat([
    randomBytes(randomLength),
    new Uint8Array(size),
  ]).subarray(0, size);
  const digest = await sha256.digest(data);
  const cid = CID.createV1(raw.code, digest);

  return { cid, data };
}

async function createBitswapBlock(
  size = 1024,
): Promise<{ cid: CID; block: Block }> {
  const { cid, data } = await createBlock(size);

  return {
    cid,
    block: {
      prefix: cidToPrefix(cid),
      data,
    },
  };
}

async function createBlockPresence(
  size = 1024,
): Promise<{ cid: CID; presence: BlockPresence }> {
  const { cid } = await createBlock(size);

  return {
    cid,
    presence: {
      cid: cid.bytes,
      type: BlockPresenceType.HaveBlock,
    },
  };
}

async function createWant(
  size = 1024,
): Promise<{ cid: CID; entry: WantlistEntry }> {
  const { cid } = await createBlock(size);

  return {
    cid,
    entry: {
      cid: cid.bytes,
      priority: 0,
    },
  };
}

describe("split-message", () => {
  it("should not split a small message", async () => {
    const input = new QueuedBitswapMessage(true);
    const want = await createWant();
    input.addWantlistEntry(want.cid, want.entry);

    const output = all(splitMessage(input, DEFAULT_MAX_OUTGOING_MESSAGE_SIZE));

    expect(output).to.have.lengthOf(1);
    expect(BitswapMessage.decode(output[0])).to.have.nested.property(
      "wantlist.full",
      true,
    );
  });

  it("should split a message with a max size block", async () => {
    const input = new QueuedBitswapMessage();
    const block = await createBitswapBlock(MAX_BLOCK_SIZE);
    input.addBlock(block.cid, block.block);

    const output = all(splitMessage(input, DEFAULT_MAX_OUTGOING_MESSAGE_SIZE));

    expect(output).to.have.lengthOf(1);
    expect(output)
      .to.have.nested.property("[0].byteLength")
      .that.is.lessThan(DEFAULT_MAX_OUTGOING_MESSAGE_SIZE);
  });

  it("should split a big message", async () => {
    const input = new QueuedBitswapMessage();
    const block1 = await createBitswapBlock(
      DEFAULT_MAX_OUTGOING_MESSAGE_SIZE / 2,
    );
    const block2 = await createBitswapBlock(
      DEFAULT_MAX_OUTGOING_MESSAGE_SIZE / 2,
    );
    input.addBlock(block1.cid, block1.block);
    input.addBlock(block2.cid, block2.block);

    const output = all(splitMessage(input, DEFAULT_MAX_OUTGOING_MESSAGE_SIZE));

    expect(output).to.have.lengthOf(2);
  });

  it("should send blocks before presences", async () => {
    const presences = 4096;
    const input = new QueuedBitswapMessage();

    for (let i = 0; i < presences; i++) {
      const presence = await createBlockPresence();
      input.addBlockPresence(presence.cid, presence.presence);
    }

    const block1 = await createBitswapBlock(MAX_BLOCK_SIZE);
    const block2 = await createBitswapBlock(MAX_BLOCK_SIZE);
    input.addBlock(block1.cid, block1.block);
    input.addBlock(block2.cid, block2.block);

    const output = all(splitMessage(input, MAX_BLOCK_SIZE + 50));
    expect(output).to.have.lengthOf(3);

    expect(BitswapMessage.decode(output[0]).blockPresences).to.be.empty();
    expect(BitswapMessage.decode(output[1]).blockPresences).to.be.empty();
    expect(BitswapMessage.decode(output[2]).blockPresences).to.have.lengthOf(
      presences,
    );
  });

  it("should send presences before wants", async () => {
    // CID + integer is 40 bytes
    const wants = Math.round(DEFAULT_MAX_OUTGOING_MESSAGE_SIZE / 40);
    const presences = Math.round(DEFAULT_MAX_OUTGOING_MESSAGE_SIZE / 40);
    const input = new QueuedBitswapMessage();

    for (let i = 0; i < wants; i++) {
      const want = await createWant();
      input.addWantlistEntry(want.cid, want.entry);
    }

    for (let i = 0; i < presences; i++) {
      const presence = await createBlockPresence();
      input.addBlockPresence(presence.cid, presence.presence);
    }

    const block1 = await createBitswapBlock(MAX_BLOCK_SIZE);
    const block2 = await createBitswapBlock(MAX_BLOCK_SIZE);
    input.addBlock(block1.cid, block1.block);
    input.addBlock(block2.cid, block2.block);

    const output = all(splitMessage(input, MAX_BLOCK_SIZE + 50));
    expect(output).to.have.lengthOf(5);

    for (const buf of output) {
      expect(buf)
        .to.have.property("byteLength")
        .that.is.lessThanOrEqual(DEFAULT_MAX_OUTGOING_MESSAGE_SIZE);
    }

    const message1 = BitswapMessage.decode(output[0]);
    expect(message1).to.have.property("blocks").with.lengthOf(1);
    expect(message1)
      .to.have.nested.property("wantlist.entries")
      .with.lengthOf(0);
    expect(message1).to.have.nested.property("blockPresences").with.lengthOf(0);

    const message2 = BitswapMessage.decode(output[1]);
    expect(message2).to.have.property("blocks").with.lengthOf(1);
    expect(message2)
      .to.have.nested.property("wantlist.entries")
      .with.lengthOf(0);
    expect(message2).to.have.nested.property("blockPresences").with.lengthOf(0);

    const message3 = BitswapMessage.decode(output[2]);
    expect(message3).to.have.property("blocks").with.lengthOf(0);
    expect(message3)
      .to.have.nested.property("wantlist.entries")
      .with.lengthOf(0);
    expect(message3)
      .to.have.nested.property("blockPresences")
      .with.lengthOf(104842);

    const message4 = BitswapMessage.decode(output[3]);
    expect(message4).to.have.property("blocks").with.lengthOf(0);
    expect(message4)
      .to.have.nested.property("wantlist.entries")
      .with.lengthOf(104826);
    expect(message4)
      .to.have.nested.property("blockPresences")
      .with.lengthOf(16);

    const message5 = BitswapMessage.decode(output[4]);
    expect(message5).to.have.property("blocks").with.lengthOf(0);
    expect(message5)
      .to.have.nested.property("wantlist.entries")
      .with.lengthOf(32);
    expect(message5).to.have.nested.property("blockPresences").with.lengthOf(0);
  });

  it("should throw when block size is too large", async () => {
    const input = new QueuedBitswapMessage();
    const block = await createBitswapBlock(MAX_BLOCK_SIZE + 1);
    input.addBlock(block.cid, block.block);

    expect(() => all(splitMessage(input, DEFAULT_MAX_OUTGOING_MESSAGE_SIZE)))
      .to.throw()
      .with.property("code", "ERR_BLOCK_TOO_LARGE");
  });
});
