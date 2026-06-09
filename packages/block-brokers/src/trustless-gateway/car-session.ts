import { CarBlockIterator } from '@ipld/car'
import { isPeerId } from '@libp2p/interface'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import { base64 } from 'multiformats/bases/base64'
import { DEFAULT_ALLOW_INSECURE, DEFAULT_ALLOW_LOCAL, DEFAULT_MAX_SIZE } from './index.ts'
import { TrustlessGateway } from './trustless-gateway.ts'
import { filterNonHTTPMultiaddrs, findHttpGatewayProviders } from './utils.ts'
import type { CreateTrustlessGatewaySessionOptions } from './broker.ts'
import type { TrustlessGatewayGetBlockProgressEvents } from './index.ts'
import type { TrustlessGatewaySessionComponents } from './session.ts'
import type { TransformRequestInit } from './trustless-gateway.ts'
import type { BlockRetrievalOptions, Routing, SessionBlockBroker } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger, PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { CID } from 'multiformats/cid'

/**
 * Default soft-to-hard cap on blocks parsed from the CAR stream but not yet
 * requested by the consumer. The gateway emits the DAG in the same depth-first
 * order a walk asks for it, so in practice the buffer stays near-empty; the cap
 * bounds the pathological case where the stream order diverges from the walk.
 */
export const DEFAULT_MAX_BUFFERED_BLOCKS = 128

/**
 * How long the pump may sit paused on a full buffer with no waiter before the
 * CAR fetch is torn down. This bounds the resource an abandoned session holds
 * (`SessionBlockBroker` has no close hook — see
 * https://github.com/ipfs/helia/issues/1051), after which later retrieves
 * recover blocks over per-block raw fetches.
 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 60_000

interface Waiter {
  resolve(bytes: Uint8Array | null): void
  reject(err: unknown): void
}

/**
 * Index key for a block: its multihash bytes, so CIDv0/v1 forms of the same
 * block collapse to one entry.
 */
function blockKey (cid: CID): string {
  return base64.encode(cid.multihash.bytes)
}

/**
 * A session that fetches the whole DAG over a single `?format=car` request to
 * one trustless gateway, then serves each block the consumer asks for from the
 * streamed CAR. This collapses the one-request-per-block cost of the default
 * session to a single request for many-small-block DAGs (a sharded HAMT
 * directory is hundreds of tiny blocks).
 *
 * The CAR is untrusted: every block is verified through the per-retrieve
 * `validateFn` before it is returned, exactly as the default broker does. A
 * block the CAR omits, or one whose bytes fail that check, falls through to a
 * single `?format=raw` fetch for that block; if the raw fetch also fails or
 * mismatches, the retrieve rejects.
 *
 * The session is scoped to the first CID it is asked for, which it treats as
 * the CAR root. This mirrors how `AbstractSession` scopes provider discovery to
 * the first retrieved CID, and is necessary because `createSession` is not
 * passed the root (see https://github.com/ipfs/helia/issues/1051). It does not
 * extend `AbstractSession`: that class models per-block, per-provider racing,
 * which is orthogonal to a single root-scoped stream.
 */
class TrustlessGatewayCarSession implements SessionBlockBroker<TrustlessGatewayGetBlockProgressEvents> {
  public readonly name = 'trustless-gateway-car-session'
  private readonly routing: Routing
  private readonly logger: ComponentLogger
  private readonly log: Logger
  private readonly allowInsecure: boolean
  private readonly allowLocal: boolean
  private readonly transformRequestInit?: TransformRequestInit
  private readonly maxBuffered: number
  private readonly idleTimeoutMs: number

  /** Session providers passed by the caller, tried before routing discovery. */
  readonly #initialProviders: Array<PeerId | Multiaddr | Multiaddr[]>
  #root: CID | null = null
  /** The gateway serving the CAR stream, used for raw gap-fill too. */
  #gateway: TrustlessGateway | null = null
  /** Extra gateways added via `addPeer`, tried for gap-fill if the primary fails. */
  readonly #extraGateways: TrustlessGateway[] = []
  /**
   * Signal passed to the CAR fetch and gateway discovery. It is deliberately
   * NOT tied to per-retrieve signals (`raceBlockRetrievers` aborts those after
   * every block). With no session-close hook on `SessionBlockBroker` there is
   * no trigger to abort it today; an abandoned session's fetch is instead
   * bounded by the buffer cap, which backpressures the stream once full. A
   * close hook (see https://github.com/ipfs/helia/issues/1051) would let this
   * cancel the stream eagerly.
   */
  readonly #controller = new AbortController()
  /** Parsed-but-not-yet-requested blocks, keyed by multihash. Hard-bounded by `maxBuffered`. */
  readonly #arrived = new Map<string, Uint8Array>()
  /** One-shot waiters per multihash; resolved with bytes on arrival, null on stream end. */
  readonly #waiters = new Map<string, Waiter[]>()
  #streamEnded = false
  #streamError: unknown = null
  #wakePump: (() => void) | null = null
  #gapFillCount = 0

  constructor (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions) {
    this.log = components.logger.forComponent('helia:trustless-gateway-car-session')
    this.logger = components.logger
    this.routing = components.routing
    this.allowInsecure = init.allowInsecure ?? DEFAULT_ALLOW_INSECURE
    this.allowLocal = init.allowLocal ?? DEFAULT_ALLOW_LOCAL
    this.transformRequestInit = init.transformRequestInit
    this.maxBuffered = DEFAULT_MAX_BUFFERED_BLOCKS
    this.idleTimeoutMs = DEFAULT_STREAM_IDLE_TIMEOUT_MS
    this.#initialProviders = [...(init.providers ?? [])]
  }

  /**
   * The number of blocks served by the raw fallback rather than the CAR stream.
   * A non-zero count means the gateway's CAR was incomplete for this root.
   */
  get gapFillCount (): number {
    return this.#gapFillCount
  }

  async retrieve (cid: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents> = {}): Promise<Uint8Array> {
    options.signal?.throwIfAborted()

    // The CAR stream must outlive any single retrieve. `raceBlockRetrievers`
    // aborts the per-retrieve signal in `finally` after every successful block
    // (helia/utils storage.ts), so the stream is deliberately NOT tied to it —
    // it runs on its own `#controller`. A parked retrieve still honours its own
    // signal (see `#awaitBlock`). With no session-close hook on
    // `SessionBlockBroker` (https://github.com/ipfs/helia/issues/1051), an
    // abandoned stream is bounded by the buffer cap and torn down after an idle
    // timeout rather than cancelled eagerly.
    const key = blockKey(cid)

    if (this.#root == null) {
      this.#root = cid
      void this.#startStream(cid, options)
    }

    const buffered = this.#arrived.get(key)
    if (buffered != null) {
      this.#arrived.delete(key)
      this.#resumePump()
      return this.#serve(cid, buffered, options)
    }

    // streamEnded/streamError → the block did not arrive; #controller.aborted →
    // the stream was torn down (idle timeout). All three mean: recover via raw.
    if (this.#streamEnded || this.#streamError != null || this.#controller.signal.aborted) {
      return this.#gapFill(cid, options)
    }

    const delivered = await this.#awaitBlock(key, options.signal)
    if (delivered != null) {
      return this.#serve(cid, delivered, options)
    }

    return this.#gapFill(cid, options)
  }

  async addPeer (peer: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<void> {
    const gateway = await this.#toGateway(peer)
    if (gateway == null) {
      return
    }
    if (this.#gateway?.url.toString() === gateway.url.toString()) {
      return
    }
    if (this.#extraGateways.some(g => g.url.toString() === gateway.url.toString())) {
      return
    }
    this.#extraGateways.push(gateway)
  }

  /**
   * Verify a CAR-supplied block through the consumer's `validateFn` and honour
   * the per-retrieve `maxSize`. On a size or validation miss the block is not
   * trusted/usable, so fall back to a verified, size-limited raw fetch.
   */
  async #serve (cid: CID, bytes: Uint8Array, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents>): Promise<Uint8Array> {
    if (bytes.byteLength > (options.maxSize ?? DEFAULT_MAX_SIZE)) {
      // the caller asked for a smaller cap than this CAR block; let getRawBlock
      // enforce the caller's maxSize
      return this.#gapFill(cid, options)
    }
    if (options.validateFn == null) {
      return bytes
    }
    try {
      await options.validateFn(bytes)
      return bytes
    } catch (err) {
      // The CAR served bytes that do not hash to the CID: this gateway is
      // serving bad data, so drop its reliability and recover over raw.
      this.#gateway?.incrementInvalidBlocks()
      this.log.error('block %c from the CAR stream failed validation, falling back to a raw fetch - %e', cid, err)
      return this.#gapFill(cid, options)
    }
  }

  async #gapFill (cid: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents>): Promise<Uint8Array> {
    // Dedupe by URL: `addPeer` can land a gateway in `#extraGateways` before
    // `#startStream` resolves the same one as `#gateway`.
    const seen = new Set<string>()
    const gateways = [this.#gateway, ...this.#extraGateways].filter((g): g is TrustlessGateway => {
      if (g == null || seen.has(g.url.toString())) {
        return false
      }
      seen.add(g.url.toString())
      return true
    })
    if (gateways.length === 0) {
      throw new Error(`no gateway available to fetch block ${cid}`)
    }

    const errors: Error[] = []
    for (const gateway of gateways) {
      try {
        const block = await gateway.getRawBlock(cid, options)
        await options.validateFn?.(block)
        // Count only blocks actually served by the raw fallback: a non-zero
        // count means the gateway's CAR was incomplete for this root.
        this.#gapFillCount++
        return block
      } catch (err) {
        this.log.error('raw fallback for %c from %s failed - %e', cid, gateway.url, err)
        errors.push(err instanceof Error ? err : new Error(String(err)))
        if (options.signal?.aborted === true) {
          break
        }
      }
    }

    throw new AggregateError(errors, `Unable to fetch block ${cid} from the CAR stream or any gateway`)
  }

  #awaitBlock (key: string, signal?: AbortSignal): Promise<Uint8Array | null> {
    return new Promise<Uint8Array | null>((resolve, reject) => {
      if (this.#controller.signal.aborted) {
        reject(this.#controller.signal.reason ?? new Error('session aborted'))
        return
      }
      if (signal?.aborted === true) {
        reject(signal.reason ?? new Error('aborted'))
        return
      }

      const waiter: Waiter = { resolve, reject }

      if (signal != null) {
        const onAbort = (): void => {
          const list = this.#waiters.get(key)
          const i = list?.indexOf(waiter) ?? -1
          if (list != null && i !== -1) {
            list.splice(i, 1)
            if (list.length === 0) {
              this.#waiters.delete(key)
            }
          }
          reject(signal.reason ?? new Error('aborted'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        waiter.resolve = (bytes) => {
          signal.removeEventListener('abort', onAbort)
          resolve(bytes)
        }
        waiter.reject = (err) => {
          signal.removeEventListener('abort', onAbort)
          reject(err)
        }
      }

      const list = this.#waiters.get(key)
      if (list == null) {
        this.#waiters.set(key, [waiter])
      } else {
        list.push(waiter)
      }
      // A new waiter may need a block past a full buffer — keep the pump moving.
      this.#resumePump()
    })
  }

  /**
   * Resolve every waiter for `key` with `value` and remove them. Returns false
   * if there were none. `null` tells the parked retrieve the stream will not
   * serve this block, so it gap-fills.
   */
  #deliver (key: string, value: Uint8Array | null): boolean {
    const list = this.#waiters.get(key)
    if (list == null || list.length === 0) {
      return false
    }
    this.#waiters.delete(key)
    for (const { resolve } of list) {
      resolve(value)
    }
    return true
  }

  /** Release every parked waiter so its retrieve gap-fills. Called when the stream ends. */
  #flushWaiters (): void {
    for (const [, list] of this.#waiters) {
      for (const { resolve } of list) {
        resolve(null)
      }
    }
    this.#waiters.clear()
  }

  #resumePump (): void {
    if (this.#wakePump != null) {
      const wake = this.#wakePump
      this.#wakePump = null
      wake()
    }
  }

  async #startStream (root: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents>): Promise<void> {
    let body: ReadableStream<Uint8Array> | null = null

    try {
      for await (const gateway of this.#candidateGateways(root, options)) {
        this.#gateway ??= gateway
        try {
          body = await gateway.getCar(root, { signal: this.#controller.signal, onProgress: options.onProgress })
          this.#gateway = gateway
          break
        } catch (err) {
          this.log.error('failed to open a CAR stream from %s - %e', gateway.url, err)
        }
      }

      if (body == null) {
        this.#streamError = new Error(`no gateway served a CAR for ${root}`)
        return
      }

      for await (const { cid, bytes } of await CarBlockIterator.fromIterable(body)) {
        const key = blockKey(cid)

        // Drop blocks over the raw-path ceiling (helia#790) so they are never
        // indexed or served. Note `@ipld/car` has already read the full
        // gateway-declared block into memory by this point, so this bounds
        // retained/served bytes, not the transient per-block read — a streaming
        // cap would need support from the CAR reader. Any waiter for a dropped
        // block is released to null so its retrieve gap-fills immediately
        // (through the size-limited `getRawBlock`) rather than parking until
        // end-of-stream; leaving it parked would also disable the backpressure
        // pause below and let a huge CAR drain after the needed block was gone.
        if (bytes.byteLength > DEFAULT_MAX_SIZE) {
          this.log.error('dropping CAR block %c: %d bytes exceeds the %d limit', cid, bytes.byteLength, DEFAULT_MAX_SIZE)
          this.#deliver(key, null)
          continue
        }

        if (!this.#deliver(key, bytes) && !this.#arrived.has(key) && this.#arrived.size < this.maxBuffered) {
          this.#arrived.set(key, bytes)
        }
        // else: a non-waited block past the cap is dropped, recovered via
        // gap-fill if the consumer asks for it later. This makes the cap a hard
        // bound under stream/walk order divergence.

        // Pause only while the buffer is full AND nothing is waiting; an
        // outstanding waiter means the consumer needs a block still ahead in the
        // stream, so keep reading (dropping overflow) to reach it. If the pause
        // outlasts the idle timeout (the consumer has stopped), tear the fetch
        // down so it does not hold a socket open forever; later retrieves
        // gap-fill over raw.
        while (this.#arrived.size >= this.maxBuffered && this.#waiters.size === 0 && !this.#controller.signal.aborted) {
          const resumed = await new Promise<boolean>(resolve => {
            const timer = setTimeout(() => {
              this.#wakePump = null
              resolve(false)
            }, this.idleTimeoutMs)
            this.#wakePump = () => {
              clearTimeout(timer)
              resolve(true)
            }
          })
          if (!resumed) {
            this.#controller.abort(new Error('CAR stream idle timeout'))
            break
          }
        }
      }
    } catch (err) {
      this.#streamError = err
    } finally {
      this.#streamEnded = true
      this.#flushWaiters()
    }
  }

  /**
   * Gateways to try for the CAR stream: any explicitly-passed session providers
   * first (so a caller with known gateways skips routing), then routing
   * discovery. Mirrors how `AbstractSession` seeds from `init.providers`.
   */
  async * #candidateGateways (root: CID, options: BlockRetrievalOptions<TrustlessGatewayGetBlockProgressEvents>): AsyncGenerator<TrustlessGateway> {
    for (const provider of this.#initialProviders) {
      const gateway = await this.#toGateway(provider)
      if (gateway != null) {
        yield gateway
      }
    }
    yield * findHttpGatewayProviders(root, this.routing, this.logger, this.allowInsecure, this.allowLocal, {
      signal: this.#controller.signal,
      transformRequestInit: this.transformRequestInit,
      onProgress: options.onProgress
    })
  }

  async #toGateway (peer: PeerId | Multiaddr | Multiaddr[]): Promise<TrustlessGateway | undefined> {
    if (isPeerId(peer)) {
      return
    }
    const httpAddresses = filterNonHTTPMultiaddrs(Array.isArray(peer) ? peer : [peer], this.allowInsecure, this.allowLocal)
    if (httpAddresses.length === 0) {
      return
    }
    return new TrustlessGateway(multiaddrToUri(httpAddresses[0]), {
      logger: this.logger,
      transformRequestInit: this.transformRequestInit,
      routing: 'manual'
    })
  }
}

export function createTrustlessGatewayCarSession (components: TrustlessGatewaySessionComponents, init: CreateTrustlessGatewaySessionOptions): TrustlessGatewayCarSession {
  return new TrustlessGatewayCarSession(components, init)
}
