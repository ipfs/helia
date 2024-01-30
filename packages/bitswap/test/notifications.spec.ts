import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { pEvent } from 'p-event'
import { Notifications, doNotHaveEvent, haveEvent } from '../src/notifications.js'

describe('notifications', () => {
  let notifications: Notifications

  before(() => {
    notifications = new Notifications({
      logger: defaultLogger()
    })
  })

  it('should notify wants after receiving a block', async () => {
    const peerId = await createEd25519PeerId()
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const data = Uint8Array.from([0, 1, 2, 3, 4])

    const p = notifications.wantBlock(cid)

    notifications.receivedBlock(cid, data, peerId)

    const block = await p

    expect(block).to.equalBytes(data)
  })

  it('should notify wants after unwanting a block', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const p = notifications.wantBlock(cid)

    notifications.unwantBlock(cid)

    await expect(p).to.eventually.rejected.with.property('code', 'ERR_UNWANTED')
  })

  it('should notify wants aborting wanting a block', async () => {
    const signal = AbortSignal.timeout(100)
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const p = notifications.wantBlock(cid, {
      signal
    })

    await expect(p).to.eventually.rejected.with.property('code', 'ERR_ABORTED')
  })

  it('should notify on have', async () => {
    const peerId = await createEd25519PeerId()
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    const p = pEvent(notifications, haveEvent(cid))

    notifications.haveBlock(cid, peerId)

    await expect(p).to.eventually.equal(peerId)
  })

  it('should notify on do not have', async () => {
    const peerId = await createEd25519PeerId()
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    const p = pEvent(notifications, doNotHaveEvent(cid))

    notifications.doNotHaveBlock(cid, peerId)

    await expect(p).to.eventually.equal(peerId)
  })
})
