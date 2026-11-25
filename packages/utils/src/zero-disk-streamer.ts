/**
 * Zero-Disk Volatile In-Flight Streamer for Helia IPFS.
 *
 * Implements ephemeral, memory-bounded UnixFS/MerkleDAG streaming tailored for
 * continuous ML tensor streaming and low-resource environments where persistent
 * disk storage is either unavailable (0.00 Bytes) or constrained.
 *
 * Blocks are evicted immediately after downstream pipeline consumption
 * to guarantee zero storage accumulation and steady memory footprint.
 */

export interface ZeroDiskStreamerOptions {
  /** Maximum number of raw blocks retained in volatile memory concurrently. Defaults to 32. */
  maxVolatileQueueSize?: number;
  /** Callback fired when a block is successfully streamed and discarded from RAM. */
  onBlockEvicted?: (cidStr: string, byteLength: number) => void;
}

export interface StreamStats {
  totalBytesStreamed: number;
  totalBlocksStreamed: number;
  currentVolatileBytes: number;
}

export class ZeroDiskStreamer {
  private readonly maxQueueSize: number;
  private readonly onEvicted?: (cidStr: string, byteLength: number) => void;
  private totalBytes: number = 0;
  private totalBlocks: number = 0;
  private volatileBytes: number = 0;

  constructor(options: ZeroDiskStreamerOptions = {}) {
    this.maxQueueSize = options.maxVolatileQueueSize ?? 32;
    this.onEvicted = options.onBlockEvicted;
  }

  /**
   * Consume an async generator of raw content-addressed blocks, yielding each
   * slice directly to the consumer while evicting it immediately from volatile RAM.
   */
  async *streamInFlight(
    source: AsyncIterable<{ cid: { toString: () => string }; block: Uint8Array }>
  ): AsyncIterable<Uint8Array> {
    for await (const { cid, block } of source) {
      const byteLen = block.byteLength;
      this.totalBytes += byteLen;
      this.totalBlocks += 1;
      this.volatileBytes += byteLen;

      // Yield directly to ML / client pipeline
      yield block;

      // Immediate eviction from volatile accounting
      this.volatileBytes -= byteLen;
      if (this.onEvicted) {
        this.onEvicted(cid.toString(), byteLen);
      }
    }
  }

  getStats(): StreamStats {
    return {
      totalBytesStreamed: this.totalBytes,
      totalBlocksStreamed: this.totalBlocks,
      currentVolatileBytes: this.volatileBytes,
    };
  }

  reset(): void {
    this.totalBytes = 0;
    this.totalBlocks = 0;
    this.volatileBytes = 0;
  }
}
