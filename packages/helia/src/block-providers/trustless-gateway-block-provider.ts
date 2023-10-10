import { logger } from '@libp2p/logger'
import type { BlockProvider } from '@helia/interface/blocks'
import type { AbortOptions } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

const log = logger('helia:trustless-gateway-block-provider')

export type TrustlessGatewayGetBlockProgressEvents =
  ProgressEvent<'trustless-gateway:get-block:fetch', URL>

/**
 * A BlockProvider that accepts a list of trustless gateways that are queried
 * for blocks. Individual gateways are randomly chosen.
 */
export class TrustedGatewayBlockProvider implements BlockProvider<
ProgressOptions,
ProgressOptions<TrustlessGatewayGetBlockProgressEvents>
> {
  private readonly gateways: URL[]

  constructor (urls: Array<string | URL>) {
    this.gateways = urls.map(url => new URL(url.toString()))
  }

  async get (cid: CID, options: AbortOptions & ProgressOptions<TrustlessGatewayGetBlockProgressEvents> = {}): Promise<Uint8Array> {
    // choose a gateway
    const url = this.gateways[Math.floor(Math.random() * this.gateways.length)]

    log('getting block for %c from %s', cid, url)

    try {
      const block = await getRawBlockFromGateway(url, cid, options.signal)
      log('got block for %c from %s', cid, url)

      return block
    } catch (err: any) {
      log.error('failed to get block for %c from %s', cid, url, err)

      throw err
    }
  }
}

async function getRawBlockFromGateway (url: URL, cid: CID, signal?: AbortSignal): Promise<Uint8Array> {
  const gwUrl = new URL(url)
  gwUrl.pathname = `/ipfs/${cid.toString()}`

  // necessary as not every gateway supports dag-cbor, but every should support
  // sending raw block as-is
  gwUrl.search = '?format=raw'

  if (signal?.aborted === true) {
    throw new Error(`Signal to fetch raw block for CID ${cid} from gateway ${gwUrl.toString()} was aborted prior to fetch`)
  }

  try {
    const res = await fetch(gwUrl.toString(), {
      signal,
      headers: {
        // also set header, just in case ?format= is filtered out by some
        // reverse proxy
        Accept: 'application/vnd.ipld.raw'
      },
      cache: 'force-cache'
    })
    if (!res.ok) {
      throw new Error(`unable to fetch raw block for CID ${cid} from gateway ${gwUrl.toString()}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  } catch (cause) {
    // @ts-expect-error - TS thinks signal?.aborted can only be false now
    // because it was checked for true above.
    if (signal?.aborted === true) {
      throw new Error(`fetching raw block for CID ${cid} from gateway ${gwUrl.toString()} was aborted`)
    }
    throw new Error(`unable to fetch raw block for CID ${cid}`)
  }
}
