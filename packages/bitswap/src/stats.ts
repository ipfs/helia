import { EventEmitter } from 'events'
import type { MetricGroup, Metrics, PeerId } from '@libp2p/interface'

export interface StatsComponents {
  metrics?: Metrics
}

export class Stats extends EventEmitter {
  private readonly blocksReceived?: MetricGroup
  private readonly duplicateBlocksReceived?: MetricGroup
  private readonly dataReceived?: MetricGroup
  private readonly duplicateDataReceived?: MetricGroup

  constructor (components: StatsComponents) {
    super()

    this.blocksReceived = components.metrics?.registerMetricGroup('ipfs_bitswap_received_blocks')
    this.duplicateBlocksReceived = components.metrics?.registerMetricGroup('ipfs_bitswap_duplicate_received_blocks')
    this.dataReceived = components.metrics?.registerMetricGroup('ipfs_bitswap_data_received_bytes')
    this.duplicateDataReceived = components.metrics?.registerMetricGroup('ipfs_bitswap_duplicate_data_received_bytes')
  }

  updateBlocksReceived (count: number = 1, peerId?: PeerId): void {
    const stats: Record<string, number | unknown> = {
      global: count
    }

    if (peerId != null) {
      stats[peerId.toString()] = count
    }

    this.blocksReceived?.increment(stats)
  }

  updateDuplicateBlocksReceived (count: number = 1, peerId?: PeerId): void {
    const stats: Record<string, number | unknown> = {
      global: count
    }

    if (peerId != null) {
      stats[peerId.toString()] = count
    }

    this.duplicateBlocksReceived?.increment(stats)
  }

  updateDataReceived (bytes: number, peerId?: PeerId): void {
    const stats: Record<string, number> = {
      global: bytes
    }

    if (peerId != null) {
      stats[peerId.toString()] = bytes
    }

    this.dataReceived?.increment(stats)
  }

  updateDuplicateDataReceived (bytes: number, peerId?: PeerId): void {
    const stats: Record<string, number> = {
      global: bytes
    }

    if (peerId != null) {
      stats[peerId.toString()] = bytes
    }

    this.duplicateDataReceived?.increment(stats)
  }
}
