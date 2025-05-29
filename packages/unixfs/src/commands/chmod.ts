import * as dagPB from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { mergeOptions as mergeOpts } from '@libp2p/utils/merge-options'
import { UnixFS } from 'ipfs-unixfs'
import { recursive } from 'ipfs-unixfs-exporter'
import { importer } from 'ipfs-unixfs-importer'
import last from 'it-last'
import { pipe } from 'it-pipe'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { InvalidPBNodeError, NotUnixFSError, UnknownError } from '../errors.js'
import { SHARD_SPLIT_THRESHOLD_BYTES } from './utils/constants.js'
import { persist } from './utils/persist.js'
import { resolve, updatePathCids } from './utils/resolve.js'
import type { ChmodOptions } from '../index.js'
import type { GetStore, PutStore } from '../unixfs.js'
import type { PBNode, PBLink } from '@ipld/dag-pb'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:chmod')

const defaultOptions: ChmodOptions = {
  recursive: false,
  shardSplitThresholdBytes: SHARD_SPLIT_THRESHOLD_BYTES
}

export async function chmod (cid: CID, mode: number, blockstore: PutStore & GetStore, options: Partial<ChmodOptions> = {}): Promise<CID> {
  const opts: ChmodOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, opts.path, blockstore, options)

  log('chmod %c %d', resolved.cid, mode)

  if (opts.recursive) {
    // recursively export from root CID, change perms of each entry then reimport
    // but do not reimport files, only manipulate dag-pb nodes
    const root = await pipe(
      async function * () {
        for await (const entry of recursive(resolved.cid, blockstore, options)) {
          let metadata: UnixFS
          let links: PBLink[] = []

          if (entry.type === 'raw') {
            // convert to UnixFS
            metadata = new UnixFS({ type: 'file', data: entry.node })
          } else if (entry.type === 'file' || entry.type === 'directory') {
            metadata = entry.unixfs
            links = entry.node.Links
          } else {
            throw new NotUnixFSError()
          }

          metadata.mode = mode

          const node = {
            Data: metadata.marshal(),
            Links: links
          }

          yield {
            path: entry.path,
            content: node
          }
        }
      },
      // @ts-expect-error cannot combine progress types
      (source) => importer(source, blockstore, {
        ...opts,
        dagBuilder: async function * (source, block) {
          for await (const entry of source) {
            yield async function () {
              // @ts-expect-error cannot derive type
              const node: PBNode = entry.content

              const buf = dagPB.encode(node)
              const updatedCid = await persist(buf, block, {
                ...opts,
                cidVersion: cid.version
              })

              if (node.Data == null) {
                throw new InvalidPBNodeError(`${updatedCid} had no data`)
              }

              const unixfs = UnixFS.unmarshal(node.Data)

              return {
                cid: updatedCid,
                size: BigInt(buf.length),
                path: entry.path,
                unixfs
              }
            }
          }
        }
      }),
      async (nodes) => last(nodes)
    )

    if (root == null) {
      throw new UnknownError(`Could not chmod ${resolved.cid.toString()}`)
    }

    return updatePathCids(root.cid, resolved, blockstore, opts)
  }

  const block = await blockstore.get(resolved.cid, options)
  let metadata: UnixFS
  let links: PBLink[] = []

  if (resolved.cid.code === raw.code) {
    // convert to UnixFS
    metadata = new UnixFS({ type: 'file', data: block })
  } else {
    const node = dagPB.decode(block)

    if (node.Data == null) {
      throw new InvalidPBNodeError(`${resolved.cid.toString()} had no data`)
    }

    links = node.Links
    metadata = UnixFS.unmarshal(node.Data)
  }

  metadata.mode = mode
  const updatedBlock = dagPB.encode({
    Data: metadata.marshal(),
    Links: links
  })

  const hash = await sha256.digest(updatedBlock)
  const updatedCid = CID.create(resolved.cid.version, dagPB.code, hash)

  await blockstore.put(updatedCid, updatedBlock)

  return updatePathCids(updatedCid, resolved, blockstore, opts)
}
