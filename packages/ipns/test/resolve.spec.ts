/* eslint-env mocha */

import { Record } from "@libp2p/kad-dht";
import { defaultLogger } from "@libp2p/logger";
import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import { expect } from "aegir/chai";
import { MemoryDatastore } from "datastore-core";
import { type Datastore, Key } from "interface-datastore";
import {
  create,
  createWithExpiration,
  marshal,
  peerIdToRoutingKey,
  unmarshal,
} from "ipns";
import drain from "it-drain";
import { CID } from "multiformats/cid";
import Sinon from "sinon";
import { type StubbedInstance, stubInterface } from "sinon-ts";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { ipns } from "../src/index.js";
import type { IPNS, IPNSRouting } from "../src/index.js";
import type { Routing } from "@helia/interface";
import type { DNS } from "@multiformats/dns";

const cid = CID.parse("QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn");

describe("resolve", () => {
  let name: IPNS;
  let customRouting: StubbedInstance<IPNSRouting>;
  let datastore: Datastore;
  let heliaRouting: StubbedInstance<Routing>;
  let dns: StubbedInstance<DNS>;

  beforeEach(async () => {
    datastore = new MemoryDatastore();
    customRouting = stubInterface<IPNSRouting>();
    customRouting.get.throws(new Error("Not found"));
    heliaRouting = stubInterface<Routing>();
    dns = stubInterface<DNS>();

    name = ipns(
      {
        datastore,
        routing: heliaRouting,
        dns,
        logger: defaultLogger(),
      },
      {
        routers: [customRouting],
      },
    );
  });

  it("should resolve a record", async () => {
    const key = await createEd25519PeerId();
    const record = await name.publish(key, cid);

    // empty the datastore to ensure we resolve using the routing
    await drain(datastore.deleteMany(datastore.queryKeys({})));

    heliaRouting.get.resolves(marshal(record));

    const resolvedValue = await name.resolve(key);
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString());

    expect(heliaRouting.get.called).to.be.true();
    expect(customRouting.get.called).to.be.true();
  });

  it("should resolve a record offline", async () => {
    const key = await createEd25519PeerId();
    await name.publish(key, cid);

    expect(heliaRouting.put.called).to.be.true();
    expect(customRouting.put.called).to.be.true();

    const resolvedValue = await name.resolve(key, {
      offline: true,
    });
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString());

    expect(heliaRouting.get.called).to.be.false();
    expect(customRouting.get.called).to.be.false();
  });

  it("should skip the local cache when resolving a record", async () => {
    const cachePutSpy = Sinon.spy(datastore, "put");
    const cacheGetSpy = Sinon.spy(datastore, "get");

    const key = await createEd25519PeerId();
    const record = await name.publish(key, cid);

    heliaRouting.get.resolves(marshal(record));

    const resolvedValue = await name.resolve(key, {
      nocache: true,
    });
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString());

    expect(heliaRouting.get.called).to.be.true();
    expect(customRouting.get.called).to.be.true();

    // we call `.get` during `.put`
    cachePutSpy.calledBefore(cacheGetSpy);
  });

  it("should retrieve from local cache when resolving a record", async () => {
    const cacheGetSpy = Sinon.spy(datastore, "get");

    const key = await createEd25519PeerId();
    await name.publish(key, cid);

    const resolvedValue = await name.resolve(key);
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString());

    expect(heliaRouting.get.called).to.be.false();
    expect(customRouting.get.called).to.be.false();
    expect(cacheGetSpy.called).to.be.true();
  });

  it("should resolve a recursive record", async () => {
    const key1 = await createEd25519PeerId();
    const key2 = await createEd25519PeerId();
    await name.publish(key2, cid);
    await name.publish(key1, key2);

    const resolvedValue = await name.resolve(key1);
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString());
  });

  it("should resolve a recursive record with path", async () => {
    const key1 = await createEd25519PeerId();
    const key2 = await createEd25519PeerId();
    await name.publish(key2, cid);
    await name.publish(key1, key2);

    const resolvedValue = await name.resolve(key1);
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString());
  });

  it("should emit progress events", async function () {
    const onProgress = Sinon.stub();
    const key = await createEd25519PeerId();
    await name.publish(key, cid);

    await name.resolve(key, {
      onProgress,
    });

    expect(onProgress).to.have.property("called", true);
  });

  it("should cache a record", async function () {
    const peerId = await createEd25519PeerId();
    const customRoutingKey = peerIdToRoutingKey(peerId);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );

    expect(datastore.has(dhtKey)).to.be.false("already had record");

    const record = await create(peerId, cid, 0n, 60000);
    const marshalledRecord = marshal(record);

    customRouting.get.withArgs(customRoutingKey).resolves(marshalledRecord);

    const result = await name.resolve(peerId);
    expect(result.cid.toString()).to.equal(
      cid.toV1().toString(),
      "incorrect record resolved",
    );

    expect(datastore.has(dhtKey)).to.be.true("did not cache record locally");
  });

  it("should cache the most recent record", async function () {
    const peerId = await createEd25519PeerId();
    const customRoutingKey = peerIdToRoutingKey(peerId);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );

    const marshalledRecordA = marshal(await create(peerId, cid, 0n, 60000));
    const marshalledRecordB = marshal(await create(peerId, cid, 10n, 60000));

    // records should not match
    expect(marshalledRecordA).to.not.equalBytes(marshalledRecordB);

    // cache has older record
    await datastore.put(dhtKey, marshalledRecordA);
    customRouting.get.withArgs(customRoutingKey).resolves(marshalledRecordB);

    const result = await name.resolve(peerId);
    expect(result.cid.toString()).to.equal(
      cid.toV1().toString(),
      "incorrect record resolved",
    );

    const cached = await datastore.get(dhtKey);
    const record = Record.deserialize(cached);

    // should have cached the updated record
    expect(record.value).to.equalBytes(marshalledRecordB);
  });

  it("should include IPNS record in result", async () => {
    const key = await createEd25519PeerId();
    await name.publish(key, cid);

    const customRoutingKey = peerIdToRoutingKey(key);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );
    const buf = await datastore.get(dhtKey);
    const dhtRecord = Record.deserialize(buf);
    const record = unmarshal(dhtRecord.value);

    const result = await name.resolve(key);

    expect(result).to.have.deep.property("record", record);
  });

  it("should not search the routing for updated IPNS records when a locally cached copy is within the TTL", async () => {
    const key = await createEd25519PeerId();
    const customRoutingKey = peerIdToRoutingKey(key);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );

    // create a record with a valid lifetime and a non-expired TTL
    const ipnsRecord = await create(key, cid, 1, Math.pow(2, 10), {
      ttlNs: 10_000_000_000,
    });
    const dhtRecord = new Record(
      customRoutingKey,
      marshal(ipnsRecord),
      new Date(Date.now()),
    );

    await datastore.put(dhtKey, dhtRecord.serialize());

    const result = await name.resolve(key);
    expect(result).to.have.deep.property(
      "record",
      unmarshal(marshal(ipnsRecord)),
    );

    // should not have searched the routing
    expect(customRouting.get.called).to.be.false();
  });

  it("should search the routing for updated IPNS records when a locally cached copy has passed the TTL", async () => {
    const key = await createEd25519PeerId();

    const customRoutingKey = peerIdToRoutingKey(key);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );

    // create a record with a valid lifetime but an expired ttl
    const ipnsRecord = await create(key, cid, 1, Math.pow(2, 10), {
      ttlNs: 10,
    });
    const dhtRecord = new Record(
      customRoutingKey,
      marshal(ipnsRecord),
      new Date(Date.now() - 1000),
    );

    await datastore.put(dhtKey, dhtRecord.serialize());

    const result = await name.resolve(key);
    expect(result).to.have.deep.property(
      "record",
      unmarshal(marshal(ipnsRecord)),
    );

    // should have searched the routing
    expect(customRouting.get.called).to.be.true();
  });

  it("should search the routing for updated IPNS records when a locally cached copy has passed the TTL and choose the record with a higher sequence number", async () => {
    const key = await createEd25519PeerId();

    const customRoutingKey = peerIdToRoutingKey(key);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );

    // create a record with a valid lifetime but an expired ttl
    const ipnsRecord = await create(key, cid, 10, Math.pow(2, 10), {
      ttlNs: 10,
    });
    const dhtRecord = new Record(
      customRoutingKey,
      marshal(ipnsRecord),
      new Date(Date.now() - 1000),
    );

    await datastore.put(dhtKey, dhtRecord.serialize());

    // the routing returns a valid record with an higher sequence number
    const ipnsRecordFromRouting = await create(key, cid, 11, Math.pow(2, 10), {
      ttlNs: 10_000_000,
    });
    customRouting.get
      .withArgs(customRoutingKey)
      .resolves(marshal(ipnsRecordFromRouting));

    const result = await name.resolve(key);
    expect(result).to.have.deep.property(
      "record",
      unmarshal(marshal(ipnsRecordFromRouting)),
    );

    // should have searched the routing
    expect(customRouting.get.called).to.be.true();
  });

  it("should search the routing when a locally cached copy has an expired lifetime", async () => {
    const key = await createEd25519PeerId();

    const customRoutingKey = peerIdToRoutingKey(key);
    const dhtKey = new Key(
      "/dht/record/" + uint8ArrayToString(customRoutingKey, "base32"),
      false,
    );

    // create a record with an expired lifetime but valid TTL
    const ipnsRecord = await createWithExpiration(
      key,
      cid,
      10,
      new Date(Date.now() - Math.pow(2, 10)).toString(),
      {
        ttlNs: 10_000_000,
      },
    );
    const dhtRecord = new Record(
      customRoutingKey,
      marshal(ipnsRecord),
      new Date(Date.now()),
    );

    await datastore.put(dhtKey, dhtRecord.serialize());

    // the routing returns a valid record with an higher sequence number
    const ipnsRecordFromRouting = await create(key, cid, 11, Math.pow(2, 10), {
      ttlNs: 10_000_000,
    });
    customRouting.get
      .withArgs(customRoutingKey)
      .resolves(marshal(ipnsRecordFromRouting));

    const result = await name.resolve(key);
    expect(result).to.have.deep.property(
      "record",
      unmarshal(marshal(ipnsRecordFromRouting)),
    );

    // should have searched the routing
    expect(customRouting.get.called).to.be.true();
  });
});
