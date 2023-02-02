import { recursive } from 'ipfs-unixfs-exporter'
import { CID } from 'multiformats/cid'
import type { TouchOptions } from '../index.js'
import mergeOpts from 'merge-options'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { pipe } from 'it-pipe'
import { InvalidPBNodeError, NotUnixFSError, UnknownError } from './utils/errors.js'
import * as dagPB from '@ipld/dag-pb'
import type { PBNode, PBLink } from '@ipld/dag-pb'
import { importer } from 'ipfs-unixfs-importer'
import { persist } from './utils/persist.js'
import type { Blockstore } from 'interface-blockstore'
import last from 'it-last'
import { sha256 } from 'multiformats/hashes/sha2'
import { resolve, updatePathCids } from './utils/resolve.js'
import * as raw from 'multiformats/codecs/raw'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:touch')

const defaultOptions = {
  recursive: false
}

export async function touch (cid: CID, blockstore: Blockstore, options: Partial<TouchOptions> = {}): Promise<CID> {
  const opts: TouchOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, opts.path, blockstore, opts)
  const mtime = opts.mtime ?? {
    secs: Date.now() / 1000,
    nsecs: 0
  }

  log('touch %c %o', resolved.cid, mtime)

  if (opts.recursive) {
    // recursively export from root CID, change perms of each entry then reimport
    // but do not reimport files, only manipulate dag-pb nodes
    const root = await pipe(
      async function * () {
        for await (const entry of recursive(resolved.cid, blockstore)) {
          let metadata: UnixFS
          let links: PBLink[]

          if (entry.type === 'raw') {
            metadata = new UnixFS({ data: entry.node })
            links = []
          } else if (entry.type === 'file' || entry.type === 'directory') {
            metadata = entry.unixfs
            links = entry.node.Links
          } else {
            throw new NotUnixFSError()
          }

          metadata.mtime = mtime

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
      // @ts-expect-error we account for the incompatible source type with our custom dag builder below
      (source) => importer(source, blockstore, {
        ...opts,
        pin: false,
        dagBuilder: async function * (source, block, opts) {
          for await (const entry of source) {
            yield async function () {
              // @ts-expect-error cannot derive type
              const node: PBNode = entry.content

              const buf = dagPB.encode(node)
              const cid = await persist(buf, block, opts)

              if (node.Data == null) {
                throw new InvalidPBNodeError(`${cid} had no data`)
              }

              const unixfs = UnixFS.unmarshal(node.Data)

              return {
                cid,
                size: buf.length,
                path: entry.path,
                unixfs
              }
            }
          }
        }
      }),
      async (nodes) => await last(nodes)
    )

    if (root == null) {
      throw new UnknownError(`Could not chmod ${resolved.cid.toString()}`)
    }

    return await updatePathCids(root.cid, resolved, blockstore, options)
  }

  const block = await blockstore.get(resolved.cid)
  let metadata: UnixFS
  let links: PBLink[] = []

  if (resolved.cid.code === raw.code) {
    metadata = new UnixFS({ data: block })
  } else {
    const node = dagPB.decode(block)
    links = node.Links

    if (node.Data == null) {
      throw new InvalidPBNodeError(`${resolved.cid.toString()} had no data`)
    }

    metadata = UnixFS.unmarshal(node.Data)
  }

  metadata.mtime = mtime
  const updatedBlock = dagPB.encode({
    Data: metadata.marshal(),
    Links: links
  })

  const hash = await sha256.digest(updatedBlock)
  const updatedCid = CID.create(resolved.cid.version, dagPB.code, hash)

  await blockstore.put(updatedCid, updatedBlock)

  return await updatePathCids(updatedCid, resolved, blockstore, options)
}
