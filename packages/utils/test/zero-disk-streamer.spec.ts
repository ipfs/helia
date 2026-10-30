import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ZeroDiskStreamer } from '../src/zero-disk-streamer.ts'

describe('ZeroDiskStreamer', () => {
  it('streams blocks in-flight and discards memory immediately', async () => {
    const evicted: string[] = []
    const streamer = new ZeroDiskStreamer({
      onBlockEvicted: (cid) => {
        evicted.push(cid)
      }
    })

    async function* mockBlockGenerator() {
      for (let i = 0; i < 5; i++) {
        yield {
          cid: { toString: () => `bafybeiccid${i}` },
          block: new Uint8Array(1024), // 1 KB block
        }
      }
    }

    let chunksCount = 0
    for await (const chunk of streamer.streamInFlight(mockBlockGenerator())) {
      assert.strictEqual(chunk.byteLength, 1024)
      chunksCount++
    }

    assert.strictEqual(chunksCount, 5)
    assert.strictEqual(evicted.length, 5)
    const stats = streamer.getStats()
    assert.strictEqual(stats.totalBytesStreamed, 5120)
    assert.strictEqual(stats.totalBlocksStreamed, 5)
    assert.strictEqual(stats.currentVolatileBytes, 0) // Strictly 0 bytes retained
  })
})
