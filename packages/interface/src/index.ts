/**
 * @packageDocumentation
 *
 * The API defined by a {@link Helia} node
 *
 * @example
 *
 * ```typescript
 * import type { Helia } from '@helia/interface'
 *
 * export function doSomething(helia: Helia) {
 *   // use helia node functions here
 * }
 * ```
 */

import type { Blocks } from './blocks.ts'
import type { Keychain } from './keychain.ts'
import type { Pins } from './pins.ts'
import type { Routing } from './routing.ts'
import type { ComponentLogger, Libp2p, Metrics, TypedEventEmitter } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { AbortOptions } from 'abort-error'
import type { Datastore } from 'interface-datastore'
import type { BlockCodec, MultihashHasher } from 'multiformats'
import type { CID, MultihashDigest } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export interface CodecLoader {
  <T = any, Code extends number = any>(code: Code, options?: AbortOptions): BlockCodec<Code, T> | Promise<BlockCodec<Code, T>>
}

export interface HasherLoader {
  (code: number, options?: AbortOptions): MultihashHasher | Promise<MultihashHasher>
}

export interface CryptoKeyLoader {
  (codeOrName: number | string, options?: AbortOptions): CryptoKeyImplementation | Promise<CryptoKeyImplementation>
}

export interface PublicKey {
  /**
   * The type of the crypto implementation, e.g. `Ed15519`
   */
  type: string

  /**
   * The code that is used as the `Type` field in the protobuf representation of
   * the public/private keys
   */
  code: number

  /**
   * The raw public key
   */
  raw: ArrayBuffer

  /**
   * Return a MultihashDigest that represents this key
   */
  toMultihash (): MultihashDigest

  /**
   * Return the libp2p-key CID that represents this key
   */
  toCID (): CID<unknown, 0x72>

  /**
   * Verify the passed message against it's signature
   */
  verify(message: Uint8Array, signature: Uint8Array, options?: AbortOptions): boolean | Promise<boolean>
}

export function isPublicKey (obj?: any): obj is PublicKey {
  if (obj == null) {
    return false
  }

  return typeof obj.type === 'string' && typeof obj.code === 'number' && typeof obj.verify === 'function'
}

export interface PrivateKey {
  /**
   * The type of the crypto implementation, e.g. `Ed15519`
   */
  type: string

  /**
   * The code that is used as the `Type` field in the protobuf representation of
   * the public/private keys
   */
  code: number

  /**
   * The raw private key
   */
  raw: ArrayBuffer

  /**
   * The public key that corresponds to this private key
   */
  publicKey: PublicKey

  /**
   * Sign the passed message and return a signature
   */
  sign(message: Uint8Array, options?: AbortOptions): Uint8Array<ArrayBuffer> | Promise<Uint8Array<ArrayBuffer>>
}

export function isPrivateKey (obj?: any): obj is PrivateKey {
  if (obj == null) {
    return false
  }

  return typeof obj.type === 'string' && typeof obj.code === 'number' && typeof obj.sign === 'function' && isPublicKey(obj.publicKey)
}

export interface CipherOptions {
  iterations?: number
  hash?: string
  keyLength?: number
  algorithm?: string
}

export interface Cipher {
  encrypt(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>>
  decrypt(salt: Uint8Array, iv: Uint8Array, cipherText: Uint8Array, options?: CipherOptions): Promise<Uint8Array<ArrayBuffer>>
}

export interface CryptoKeyImplementation {
  /**
   * The type of the crypto implementation, e.g. `Ed15519`
   */
  type: string

  /**
   * The code that is used as the `Type` field in the protobuf representation of
   * the public/private keys
   */
  code: number

  /**
   * Create a new private key
   */
  createPrivateKey(options?: AbortOptions & Record<string, any>): Promise<PrivateKey>

  /**
   * Convert the passed bytes into a public key. The bytes come from the `.Data`
   * field of a `PublicKey` protobuf message.
   */
  publicKeyFromArray(key: ArrayBuffer | Uint8Array, options?: AbortOptions): PublicKey | Promise<PublicKey>

  /**
   * Convert a private key into a string suitable for storing in a datastore
   */
  serialize (key: PrivateKey, cipher: Cipher): Promise<string>

  /**
   * Convert a string from a datastore into a private key
   */
  deserialize (pem: string, cipher: Cipher): Promise<PrivateKey>
}

/**
 * The API presented by a Helia node
 */
export interface Helia<T extends Libp2p = Libp2p> {
  /**
   * The libp2p instance
   */
  libp2p: T

  /**
   * Where the blocks are stored
   */
  blockstore: Blocks

  /**
   * A key/value store
   */
  datastore: Datastore

  /**
   * Event emitter for Helia start and stop events
   */
  events: TypedEventEmitter<HeliaEvents<T>>

  /**
   * Secure storage for private keys
   */
  keychain: Keychain

  /**
   * Pinning operations for blocks in the blockstore
   */
  pins: Pins

  /**
   * A logging component that can be reused by consumers
   */
  logger: ComponentLogger

  /**
   * The routing component allows performing operations such as looking up
   * content providers, information about peers, etc.
   */
  routing: Routing

  /**
   * The DNS property can be used to perform lookups of various record types and
   * will use a resolver appropriate to the current platform.
   */
  dns: DNS

  /**
   * A metrics object that can be used to collected arbitrary stats about node
   * usage.
   */
  metrics?: Metrics

  /**
   * Starts the Helia node
   */
  start(): Promise<void>

  /**
   * Stops the Helia node
   */
  stop(): Promise<void>

  /**
   * Remove any unpinned blocks from the blockstore
   */
  gc(options?: GCOptions): Promise<void>

  /**
   * Load an IPLD codec. Implementations may return a promise if, for example,
   * the codec is being fetched from the network.
   */
  getCodec: CodecLoader

  /**
   * Hashers can be used to hash a piece of data with the specified hashing
   * algorithm. Implementations may return a promise if, for example,
   * the hasher is being fetched from the network.
   */
  getHasher: HasherLoader

  /**
   * Cryptography implementations securely sign and verify data
   */
  getCryptoKey: CryptoKeyLoader
}

export type GcEvents =
  ProgressEvent<'helia:gc:deleted', CID> |
  ProgressEvent<'helia:gc:error', Error>

export interface GCOptions extends AbortOptions, ProgressOptions<GcEvents> {

}

export interface HeliaEvents<T extends Libp2p = Libp2p> {
  /**
   * This event notifies listeners that the node has started
   *
   * ```TypeScript
   * helia.addEventListener('start', (event) => {
   *   console.info(event.detail.libp2p.isStarted()) // true
   * })
   * ```
   */
  start: CustomEvent<Helia<T>>

  /**
   * This event notifies listeners that the node has stopped
   *
   * ```TypeScript
   * helia.addEventListener('stop', (event) => {
   *   console.info(event.detail.libp2p.isStarted()) // false
   * })
   * ```
   */
  stop: CustomEvent<Helia<T>>
}

export * from './blocks.ts'
export * from './errors.ts'
export * from './keychain.ts'
export * from './pins.ts'
export * from './routing.ts'
