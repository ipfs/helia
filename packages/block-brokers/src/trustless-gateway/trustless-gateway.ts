import { base64 } from 'multiformats/bases/base64'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

export interface TrustlessGatewayStats {
  attempts: number
  errors: number
  invalidBlocks: number
  successes: number
  pendingResponses?: number
}

export interface TransformRequestInit {
  (defaultReqInit: RequestInit): Promise<RequestInit> | RequestInit
}

export interface TrustlessGatewayComponents {
  logger: ComponentLogger
  transformRequestInit?: TransformRequestInit
}

/**
 * A `TrustlessGateway` keeps track of the number of attempts, errors, and
 * successes for a given gateway url so that we can prioritize gateways that
 * have been more reliable in the past, and ensure that requests are distributed
 * across all gateways within a given `TrustlessGatewayBlockBroker` instance.
 */
export class TrustlessGateway {
  public readonly url: URL
  /**
   * The number of times this gateway has been attempted to be used to fetch a
   * block. This includes successful, errored, and aborted attempts. By counting
   * even aborted attempts, slow gateways that are out-raced by others will be
   * considered less reliable.
   */
  #attempts = 0

  /**
   * The number of times this gateway has errored while attempting to fetch a
   * block. This includes `response.ok === false` and any other errors that
   * throw while attempting to fetch a block. This does not include aborted
   * attempts.
   */
  #errors = 0

  /**
   * The number of times this gateway has returned an invalid block. A gateway
   * that returns the wrong blocks for a CID should be considered for removal
   * from the list of gateways to fetch blocks from.
   */
  #invalidBlocks = 0

  /**
   * The number of times this gateway has successfully fetched a block.
   */
  #successes = 0

  /**
   * A map of pending responses for this gateway. This is used to ensure that
   * only one request per CID is made to a given gateway at a time, and that we
   * don't make multiple in-flight requests for the same CID to the same gateway.
   */
  readonly #pendingResponses = new Map<string, Promise<Uint8Array>>()

  private readonly log: Logger
  private readonly transformRequestInit?: TransformRequestInit

  constructor (url: URL | string, { logger, transformRequestInit }: TrustlessGatewayComponents) {
    this.url = url instanceof URL ? url : new URL(url)
    this.transformRequestInit = transformRequestInit
    this.log = logger.forComponent(`helia:trustless-gateway-block-broker:${this.url.hostname}`)
  }

  /**
   * This function returns a unique string for the multihash.bytes of the CID.
   *
   * Some useful resources for why this is needed can be found using the links below:
   *
   * - https://github.com/ipfs/helia/pull/503#discussion_r1572451331
   * - https://github.com/ipfs/kubo/issues/6815
   * - https://www.notion.so/pl-strflt/Handling-ambiguity-around-CIDs-9d5e14f6516f438980b01ef188efe15d#d9d45cd1ed8b4d349b96285de4aed5ab
   */
  #uniqueBlockId (cid: CID): string {
    const multihashBytes = cid.multihash.bytes
    return base64.encode(multihashBytes)
  }

  /**
   * Fetch a raw block from `this.url` following the specification defined at
   * https://specs.ipfs.tech/http-gateways/trustless-gateway/
   */
  async getRawBlock (cid: CID, signal?: AbortSignal): Promise<Uint8Array> {
    const gwUrl = new URL(this.url.toString())
    gwUrl.pathname = `/ipfs/${cid.toString()}`

    // necessary as not every gateway supports dag-cbor, but every should support
    // sending raw block as-is
    gwUrl.search = '?format=raw'

    if (signal?.aborted === true) {
      throw new Error(`Signal to fetch raw block for CID ${cid} from gateway ${this.url} was aborted prior to fetch`)
    }

    const blockId = this.#uniqueBlockId(cid)

    // workaround for https://github.com/nodejs/node/issues/52635
    const innerController = new AbortController()
    const abortInnerSignal = (): void => {
      innerController.abort()
    }
    signal?.addEventListener('abort', abortInnerSignal)

    try {
      let pendingResponse: Promise<Uint8Array> | undefined = this.#pendingResponses.get(blockId)
      if (pendingResponse == null) {
        this.#attempts++
        const defaultReqInit: RequestInit = {
          signal: innerController.signal,
          headers: {
            Accept: 'application/vnd.ipld.raw'
          },
          cache: 'force-cache'
        }

        const reqInit: RequestInit = this.transformRequestInit != null ? await this.transformRequestInit(defaultReqInit) : defaultReqInit

        pendingResponse = fetch(gwUrl.toString(), reqInit).then(async (res) => {
          this.log('GET %s %d', gwUrl, res.status)
          if (!res.ok) {
            this.#errors++
            throw new Error(`unable to fetch raw block for CID ${cid} from gateway ${this.url}`)
          }
          this.#successes++
          return new Uint8Array(await res.arrayBuffer())
        })
        this.#pendingResponses.set(blockId, pendingResponse)
      }
      return await pendingResponse
    } catch (cause) {
      // @ts-expect-error - TS thinks signal?.aborted can only be false now
      // because it was checked for true above.
      if (signal?.aborted === true) {
        throw new Error(`fetching raw block for CID ${cid} from gateway ${this.url} was aborted`)
      }
      this.#errors++
      throw new Error(`unable to fetch raw block for CID ${cid}`)
    } finally {
      signal?.removeEventListener('abort', abortInnerSignal)
      this.#pendingResponses.delete(blockId)
    }
  }

  /**
   * Encapsulate the logic for determining whether a gateway is considered
   * reliable, for prioritization. This is based on the number of successful attempts made
   * and the number of errors encountered.
   *
   * Unused gateways have 100% reliability; They will be prioritized over
   * gateways with a 100% success rate to ensure that we attempt all gateways.
   */
  reliability (): number {
    /**
     * if we have never tried to use this gateway, it is considered the most
     * reliable until we determine otherwise (prioritize unused gateways)
     */
    if (this.#attempts === 0) {
      return 1
    }

    if (this.#invalidBlocks > 0) {
      // this gateway may not be trustworthy..
      return -Infinity
    }

    /**
     * We have attempted the gateway, so we need to calculate the reliability
     * based on the number of attempts, errors, and successes. Gateways that
     * return a single error should drop their reliability score more than a
     * single success increases it.
     *
     * Play around with the below reliability function at https://www.desmos.com/calculator/d6hfhf5ukm
     */
    return this.#successes / (this.#attempts + (this.#errors * 3))
  }

  /**
   * Increment the number of invalid blocks returned by this gateway.
   */
  incrementInvalidBlocks (): void {
    this.#invalidBlocks++
  }

  getStats (): TrustlessGatewayStats {
    return {
      attempts: this.#attempts,
      errors: this.#errors,
      invalidBlocks: this.#invalidBlocks,
      successes: this.#successes,
      pendingResponses: this.#pendingResponses.size
    }
  }
}
