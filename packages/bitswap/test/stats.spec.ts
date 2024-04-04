import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { Stats } from '../src/stats.js'
import type { MetricGroup, Metrics } from '@libp2p/interface'

interface StubbedStatsComponents {
  metrics: StubbedInstance<Metrics>
}

describe('stats', () => {
  let stats: Stats
  let components: StubbedStatsComponents
  let metricGroup: StubbedInstance<MetricGroup>

  beforeEach(() => {
    components = {
      metrics: stubInterface<Metrics>()
    }

    metricGroup = stubInterface<MetricGroup>()

    // @ts-expect-error tsc does not select correct method overload sig
    components.metrics.registerMetricGroup.returns(metricGroup)

    stats = new Stats(components)
  })

  it('should update global blocks received', () => {
    stats.updateBlocksReceived(1)

    expect(metricGroup.increment.calledWith({
      global: 1
    })).to.be.true()
  })

  it('should update blocks received from a peer', async () => {
    const peerId = await createEd25519PeerId()

    stats.updateBlocksReceived(1, peerId)

    expect(metricGroup.increment.calledWith({
      global: 1,
      [peerId.toString()]: 1
    })).to.be.true()
  })

  it('should update global duplicate blocks received', () => {
    stats.updateDuplicateBlocksReceived(1)

    expect(metricGroup.increment.calledWith({
      global: 1
    })).to.be.true()
  })

  it('should update duplicate blocks received from a peer', async () => {
    const peerId = await createEd25519PeerId()

    stats.updateDuplicateBlocksReceived(1, peerId)

    expect(metricGroup.increment.calledWith({
      global: 1,
      [peerId.toString()]: 1
    })).to.be.true()
  })

  it('should update global data received', () => {
    stats.updateDataReceived(1)

    expect(metricGroup.increment.calledWith({
      global: 1
    })).to.be.true()
  })

  it('should update data received from a peer', async () => {
    const peerId = await createEd25519PeerId()

    stats.updateDataReceived(1, peerId)

    expect(metricGroup.increment.calledWith({
      global: 1,
      [peerId.toString()]: 1
    })).to.be.true()
  })

  it('should update global duplicate data received', () => {
    stats.updateDuplicateDataReceived(1)

    expect(metricGroup.increment.calledWith({
      global: 1
    })).to.be.true()
  })

  it('should update duplicate data received from a peer', async () => {
    const peerId = await createEd25519PeerId()

    stats.updateDuplicateDataReceived(1, peerId)

    expect(metricGroup.increment.calledWith({
      global: 1,
      [peerId.toString()]: 1
    })).to.be.true()
  })
})
