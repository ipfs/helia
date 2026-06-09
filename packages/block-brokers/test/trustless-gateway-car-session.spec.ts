import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { stubInterface } from 'sinon-ts'
import { trustlessGateway } from '../src/index.ts'
import { createTrustlessGatewayCarSession } from '../src/trustless-gateway/car-session.ts'
import type { Routing } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
import type { StubbedInstance } from 'sinon-ts'

// The same bytes the CAR test gateway in .aegir.js serves, so the CIDs match.
const BLOCK_BYTES = [
  Uint8Array.from([1, 2, 3, 4]),
  Uint8Array.from([5, 6, 7, 8]),
  Uint8Array.from([9, 10, 11, 12])
]

async function rawBlock (bytes: Uint8Array): Promise<{ cid: CID, bytes: Uint8Array }> {
  return { cid: CID.createV1(raw.code, await sha256.digest(bytes)), bytes }
}

/** A validateFn that checks the bytes hash to the requested CID, like helia's own. */
function validateFn (cid: CID): (bytes: Uint8Array) => Promise<void> {
  return async (bytes) => {
    const actual = CID.createV1(raw.code, await sha256.digest(bytes))
    if (!actual.equals(cid)) {
      throw new Error(`hash mismatch for ${cid}`)
    }
  }
}

async function carRequestCount (): Promise<number> {
  const res = await fetch(`${process.env.CAR_GATEWAY ?? ''}/car-requests`)
  const body = await res.json()
  return body.carRequests
}

describe('trustless-gateway CAR session', () => {
  let components: { logger: ComponentLogger, routing: StubbedInstance<Required<Routing>> }
  let root: { cid: CID, bytes: Uint8Array }
  let inCar: { cid: CID, bytes: Uint8Array }
  let missing: { cid: CID, bytes: Uint8Array }

  beforeEach(async () => {
    components = {
      logger: defaultLogger(),
      routing: stubInterface()
    }

    ;[root, inCar, missing] = await Promise.all(BLOCK_BYTES.map(rawBlock))

    // every session discovers the CAR gateway
    components.routing.findProviders.callsFake(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [uriToMultiaddr(process.env.CAR_GATEWAY ?? '')],
        routing: 'test-routing'
      }
    })
  })

  it('serves the root and an in-CAR block from a single CAR request', async () => {
    const session = createTrustlessGatewayCarSession(components, { allowInsecure: true, allowLocal: true })
    const before = await carRequestCount()

    await expect(session.retrieve(root.cid, { validateFn: validateFn(root.cid) })).to.eventually.deep.equal(root.bytes)
    await expect(session.retrieve(inCar.cid, { validateFn: validateFn(inCar.cid) })).to.eventually.deep.equal(inCar.bytes)

    expect(await carRequestCount() - before).to.equal(1)
    expect(session.gapFillCount).to.equal(0)
  })

  it('gap-fills a block missing from the CAR over a raw request', async () => {
    const session = createTrustlessGatewayCarSession(components, { allowInsecure: true, allowLocal: true })

    // open the stream on the root, then ask for the block the CAR omits
    await session.retrieve(root.cid, { validateFn: validateFn(root.cid) })
    await expect(session.retrieve(missing.cid, { validateFn: validateFn(missing.cid) })).to.eventually.deep.equal(missing.bytes)

    expect(session.gapFillCount).to.equal(1)
  })

  it('gap-fills when a CAR block fails validation', async () => {
    const session = createTrustlessGatewayCarSession(components, { allowInsecure: true, allowLocal: true })
    await session.retrieve(root.cid, { validateFn: validateFn(root.cid) })

    // force the in-CAR block to fail validation once, so it falls back to raw
    let calls = 0
    const flakyValidate = async (bytes: Uint8Array): Promise<void> => {
      calls++
      if (calls === 1) {
        throw new Error('synthetic validation failure')
      }
      await validateFn(inCar.cid)(bytes)
    }

    await expect(session.retrieve(inCar.cid, { validateFn: flakyValidate })).to.eventually.deep.equal(inCar.bytes)
    expect(session.gapFillCount).to.equal(1)
  })

  it('rejects when the block is in neither the CAR nor a raw response', async () => {
    const session = createTrustlessGatewayCarSession(components, { allowInsecure: true, allowLocal: true })
    await session.retrieve(root.cid, { validateFn: validateFn(root.cid) })

    const absent = CID.createV1(raw.code, await sha256.digest(Uint8Array.from([99, 98, 97, 96])))
    await expect(session.retrieve(absent, { validateFn: validateFn(absent) })).to.eventually.be.rejected()
  })

  // raceBlockRetrievers aborts each retrieve's signal in `finally` after a
  // successful block. The CAR stream must survive that so later blocks still
  // come from the one stream rather than re-fetching per block.
  it('keeps the stream alive when a completed retrieve signal is aborted', async () => {
    const session = createTrustlessGatewayCarSession(components, { allowInsecure: true, allowLocal: true })
    const before = await carRequestCount()

    const controller = new AbortController()
    await session.retrieve(root.cid, { validateFn: validateFn(root.cid), signal: controller.signal })
    controller.abort() // mimic raceBlockRetrievers cleanup after the root resolves

    await expect(session.retrieve(inCar.cid, { validateFn: validateFn(inCar.cid) })).to.eventually.deep.equal(inCar.bytes)

    expect(await carRequestCount() - before).to.equal(1)
    expect(session.gapFillCount).to.equal(0)
  })

  it('uses explicitly-passed session providers before routing discovery', async () => {
    components.routing.findProviders.callsFake(async function * () {
      // no routing providers — the session must use init.providers
    })

    const session = createTrustlessGatewayCarSession(components, {
      allowInsecure: true,
      allowLocal: true,
      providers: [uriToMultiaddr(process.env.CAR_GATEWAY ?? '')]
    })

    await expect(session.retrieve(root.cid, { validateFn: validateFn(root.cid) })).to.eventually.deep.equal(root.bytes)
  })

  it('is selected only when carStreamSessions is set on the broker', () => {
    const carBroker = trustlessGateway({ allowInsecure: true, allowLocal: true, carStreamSessions: true })(components)
    expect(carBroker.createSession?.()?.name).to.equal('trustless-gateway-car-session')

    const defaultBroker = trustlessGateway({ allowInsecure: true, allowLocal: true })(components)
    expect(defaultBroker.createSession?.()?.name).to.equal('trustless-gateway-session')
  })

  it('honours a smaller per-retrieve maxSize by deferring to a size-limited raw fetch', async () => {
    const session = createTrustlessGatewayCarSession(components, { allowInsecure: true, allowLocal: true })
    await session.retrieve(root.cid, { validateFn: validateFn(root.cid) })

    // inCar is 4 bytes; maxSize 2 must not return the CAR block, and the raw
    // fallback (content-length 4) also exceeds it, so the retrieve rejects.
    await expect(session.retrieve(inCar.cid, { validateFn: validateFn(inCar.cid), maxSize: 2 })).to.eventually.be.rejected()
  })
})
