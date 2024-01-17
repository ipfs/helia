import { CarWriter } from '@ipld/car'
import toBuffer from 'it-to-buffer'
import defer from 'p-defer'
import type { CID } from 'multiformats/cid'

export interface MemoryCar extends Pick<CarWriter, 'put' | 'close'> {
  bytes(): Promise<Uint8Array>
}

export function memoryCarWriter (root: CID | CID[]): MemoryCar {
  const deferred = defer<Uint8Array>()
  const { writer, out } = CarWriter.create(Array.isArray(root) ? root : [root])

  Promise.resolve()
    .then(async () => {
      deferred.resolve(await toBuffer(out))
    })
    .catch(err => {
      deferred.reject(err)
    })

  return {
    async put (block: { cid: CID, bytes: Uint8Array }): Promise<void> {
      await writer.put(block)
    },
    async close (): Promise<void> {
      await writer.close()
    },
    async bytes (): Promise<Uint8Array> {
      return deferred.promise
    }
  }
}
