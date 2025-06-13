import { Key } from 'interface-datastore'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { Datastore } from 'interface-datastore'

const DS_VERSION_KEY = new Key('/version')
const CURRENT_VERSION = 1

export async function assertDatastoreVersionIsCurrent (datastore: Datastore): Promise<void> {
  if (!(await datastore.has(DS_VERSION_KEY))) {
    await datastore.put(DS_VERSION_KEY, uint8ArrayFromString(`${CURRENT_VERSION}`))

    return
  }

  const buf = await datastore.get(DS_VERSION_KEY)
  const str = uint8ArrayToString(buf)
  const version = parseInt(str, 10)

  if (version !== CURRENT_VERSION) {
    // TODO: write migrations when we break compatibility - for an example, see https://github.com/ipfs/js-ipfs-repo/tree/master/packages/ipfs-repo-migrations
    throw new Error('Unknown datastore version, a datastore migration may be required')
  }
}
