import type { Libp2p, MetricGroup, PeerId } from '@libp2p/interface'

export interface StatsComponents {
  libp2p: Libp2p
}

export class Stats {
  private readonly blocksReceived?: MetricGroup
  private readonly duplicateBlocksReceived?: MetricGroup
  private readonly dataReceived?: MetricGroup
  private readonly duplicateDataReceived?: MetricGroup

  constructor (components: StatsComponents) {
    this.blocksReceived = components.libp2p.metrics?.registerMetricGroup('helia_bitswap_received_blocks')
    this.duplicateBlocksReceived = components.libp2p.metrics?.registerMetricGroup('helia_bitswap_duplicate_received_blocks')
    this.dataReceived = components.libp2p.metrics?.registerMetricGroup('helia_bitswap_data_received_bytes')
    this.duplicateDataReceived = components.libp2p.metrics?.registerMetricGroup('helia_bitswap_duplicate_data_received_bytes')
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
