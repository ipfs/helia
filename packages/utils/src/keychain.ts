import { InvalidParametersError, NotStartedError, serviceCapabilities } from '@libp2p/interface'
import { Key } from 'interface-datastore/key'
import { base58btc } from 'multiformats/bases/base58'
import { base64 } from 'multiformats/bases/base64'
import { sha256 } from 'multiformats/hashes/sha2'
import sanitize from 'sanitize-filename'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer as uint8ArrayWithArrayBuffer } from 'uint8arrays/with-array-buffer'
import { DecryptionFailedError } from './errors.ts'
import { PrivateKeyMessage } from './keychain/keys.ts'
import type { Keychain as KeychainInterface, KeyInfo, PrivateKey, CryptoKeyLoader } from '@helia/interface'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { AbortOptions } from 'abort-error'
import type { Datastore } from 'interface-datastore'
import type { Batch } from 'interface-datastore'

const keyPrefix = '/pkcs8/'
const infoPrefix = '/info/'

/**
 * Default options for key derivation
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
 */
const DEK_INIT = {
  keyLength: 512 / 8,
  iterations: 10_000,
  salt: 'you should override this value with a crypto secure random number',
  hash: 'sha2-512'
}

const MIN_PASS_LENGTH = 20

// NIST SP 800-132
const NIST = {
  minKeyLength: 112 / 8,
  minSaltLength: 128 / 8,
  minIterations: 1_000
}

const KEY_LENGTHS: Record<string, number> = {
  'SHA-256': 64,
  'SHA-384': 128,
  'SHA-512': 256
}

const SALT_LENGTH = 16

export interface DEKConfig {
  hash: string
  salt: string
  iterationCount: number
  keyLength: number
}

export interface KeychainInit {
  /**
   * The password is used to derive a key which encrypts the keychain at rest
   */
  password?: string

  /**
   * Random initialization vector
   */
  salt?: string

  /**
   * How many iterations to use when deriving a key from the password
   *
   * @default 10_000
   */
  iterations?: number

  /**
   * The default key length in bytes
   *
   * @default 64
   */
  keyLength?: number

  /**
   * The hash type
   *
   * @default SHA2-512
   */
  hash?: 'SHA-256' | 'SHA-384' | 'SHA-512'

  /**
   * The 'self' key is the private key of the node from which the peer id is
   * derived.
   *
   * It cannot be renamed or removed.
   *
   * By default it is stored under the 'self' key, to use a different name, pass
   * this option.
   *
   * @default 'self'
   */
  selfKey?: string
}

export interface KeychainComponents {
  datastore: Datastore
  logger: ComponentLogger
  getCryptoKey: CryptoKeyLoader
}

function validateKeyName (name: string): boolean {
  if (name == null) {
    return false
  }

  if (typeof name !== 'string') {
    return false
  }

  return name === sanitize(name.trim()) && name.length > 0
}

/**
 * Converts a key name into a datastore name
 */
function dsName (name: string): Key {
  return new Key(keyPrefix + name)
}

/**
 * Converts a key name into a datastore info name
 */
function dsInfoName (name: string): Key {
  return new Key(infoPrefix + name)
}

export async function keyId (key: ArrayBuffer | Uint8Array): Promise<string> {
  const hash = await sha256.digest(key instanceof Uint8Array ? key : new Uint8Array(key, 0, key.byteLength))

  return base58btc.encode(hash.bytes).substring(1)
}

/**
 * Manages the life cycle of a key. Keys are encrypted at rest using PKCS #8.
 *
 * A key in the store has two entries
 * - '/info/*key-name*', contains the KeyInfo for the key
 * - '/pkcs8/*key-name*', contains the PKCS #8 for the key
 *
 */
export class Keychain implements KeychainInterface {
  private readonly components: KeychainComponents
  private readonly log: Logger
  private readonly self: string
  private key?: CryptoKey
  private salt: Uint8Array
  private iterations: number
  private keyLength: number
  private hash: 'SHA-256' | 'SHA-384' | 'SHA-512'
  private password: string

  /**
   * Creates a new instance of a key chain
   */
  constructor (components: KeychainComponents, init: KeychainInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:keychain')
    this.self = init.selfKey ?? 'self'
    this.salt = uint8ArrayFromString(init.salt ?? DEK_INIT.salt)
    this.iterations = init.iterations ?? DEK_INIT.iterations
    this.keyLength = init.keyLength ?? DEK_INIT.keyLength
    this.hash = init.hash ?? 'SHA-512'
    this.password = init.password ?? ''

    // Enforce NIST SP 800-132
    if (init.password != null && this.password.length < MIN_PASS_LENGTH) {
      throw new Error('password must be least 20 characters')
    }

    if (this.keyLength < NIST.minKeyLength) {
      throw new Error(`dek.keyLength must be least ${NIST.minKeyLength} bytes`)
    }

    if (this.salt.byteLength != null && this.salt.byteLength < NIST.minSaltLength) {
      throw new Error(`salt must be least ${NIST.minSaltLength} bytes`)
    }

    if (this.iterations < NIST.minIterations) {
      throw new Error(`iterations must be least ${NIST.minIterations}`)
    }

    if (KEY_LENGTHS[this.hash] == null) {
      throw new InvalidParametersError('Unsupported hash')
    }
  }

  readonly [Symbol.toStringTag] = '@libp2p/keychain'

  readonly [serviceCapabilities]: string[] = [
    '@libp2p/keychain'
  ]

  async start (): Promise<void> {
    this.key = await this.generateSaltedKey(this.password ?? '')
  }

  async stop (): Promise<void> {

  }

  private async generateSaltedKey (pass: string): Promise<CryptoKey> {
    const key = await crypto.subtle.importKey('raw', uint8ArrayFromString(pass), {
      name: 'PBKDF2'
    }, false, ['deriveKey'])
    return crypto.subtle.deriveKey({
      name: 'PBKDF2',
      salt: uint8ArrayWithArrayBuffer(this.salt),
      iterations: this.iterations,
      hash: this.hash
    }, key, {
      // name: 'HMAC',
      name: 'AES-GCM',
      hash: this.hash,
      length: KEY_LENGTHS[this.hash]
    }, true, ['encrypt', 'decrypt'])
  }

  async createKey (name: string, type: 'Ed25519' | 'RSA' | string, options?: AbortOptions & Record<string, any>): Promise<PrivateKey> {
    const crypto = await this.components.getCryptoKey(type, options)
    const key = await crypto.createPrivateKey(options)

    return this.importKey(name, key, options)
  }

  async importKey (name: string, key: PrivateKey, options?: AbortOptions): Promise<PrivateKey> {
    if (!validateKeyName(name)) {
      throw new InvalidParametersError(`Invalid key name '${name}'`)
    }

    if (key == null) {
      throw new InvalidParametersError('Key is required')
    }

    if (this.key == null) {
      throw new NotStartedError()
    }

    const exists = await this.components.datastore.has(dsName(name), options)

    if (exists) {
      throw new InvalidParametersError(`Key '${name}' already exists`)
    }

    const batch = this.components.datastore.batch()
    await this._importKey(name, key, this.key, batch, options)
    await batch.commit(options)

    return key
  }

  private async _importKey (name: string, privateKey: PrivateKey, key: CryptoKey, batch: Batch, options?: AbortOptions): Promise<void> {
    const data = new Uint8Array(privateKey.raw.slice())
    const protobuf = PrivateKeyMessage.encode({
      Type: privateKey.code,
      Data: data
    })

    const iv = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    const cipherText = await crypto.subtle.encrypt({
      name: 'AES-GCM',
      iv
    }, key, protobuf)
    options?.signal?.throwIfAborted()

    // prepend the iv to the buffer
    const buf = uint8ArrayConcat([
      iv,
      new Uint8Array(cipherText)
    ], iv.byteLength + cipherText.byteLength)

    const pem = base64.encode(buf)
    const keyInfo = {
      name,
      type: privateKey.type
    }

    batch.put(dsName(name), uint8ArrayFromString(pem))
    batch.put(dsInfoName(name), uint8ArrayFromString(JSON.stringify(keyInfo)))
  }

  async exportKey (name: string, options?: AbortOptions): Promise<PrivateKey> {
    if (!validateKeyName(name)) {
      throw new InvalidParametersError(`Invalid key name '${name}'`)
    }

    if (this.key == null) {
      throw new NotStartedError()
    }

    return this._exportKey(name, this.key, options)
  }

  private async _exportKey (name: string, key: CryptoKey, options?: AbortOptions): Promise<PrivateKey> {
    const res = await this.components.datastore.get(dsName(name), options)
    const pem = uint8ArrayToString(res)
    const buf = base64.decode(pem)
    const iv = buf.subarray(0, SALT_LENGTH)
    let raw: ArrayBuffer

    try {
      raw = await crypto.subtle.decrypt({
        name: 'AES-GCM',
        iv
      }, key, buf.subarray(SALT_LENGTH))
      options?.signal?.throwIfAborted()
    } catch (err: any) {
      if (err.name === 'OperationError') {
        throw new DecryptionFailedError(err.message)
      }

      throw err
    }

    const privateKeyPb = PrivateKeyMessage.decode(new Uint8Array(raw))

    if (privateKeyPb.Type == null || privateKeyPb.Data == null) {
      throw new InvalidParametersError('Decoded private key protobuf did not have Type and/or Data fields')
    }

    const cryptoImplementation = await this.components.getCryptoKey(privateKeyPb.Type)
    return cryptoImplementation.privateKeyFromArray(privateKeyPb.Data)
  }

  async removeKey (name: string, options?: AbortOptions): Promise<void> {
    if (!validateKeyName(name) || name === this.self) {
      throw new InvalidParametersError(`Invalid key name '${name}'`)
    }

    const batch = this.components.datastore.batch()
    batch.delete(dsName(name))
    batch.delete(dsInfoName(name))
    await batch.commit(options)
  }

  /**
   * List all the keys
   */
  async * listKeys (options?: AbortOptions): AsyncGenerator <KeyInfo> {
    const query = {
      prefix: infoPrefix
    }

    for await (const value of this.components.datastore.query(query, options)) {
      yield JSON.parse(uint8ArrayToString(value.value))
    }
  }

  /**
   * Rename a key
   *
   * @param {string} oldName - The old local key name; must already exist.
   * @param {string} newName - The new local key name; must not already exist.
   * @returns {Promise<KeyInfo>}
   */
  async renameKey (oldName: string, newName: string, options?: AbortOptions): Promise<void> {
    if (!validateKeyName(oldName) || oldName === this.self) {
      throw new InvalidParametersError(`Invalid old key name '${oldName}'`)
    }

    if (!validateKeyName(newName) || newName === this.self) {
      throw new InvalidParametersError(`Invalid new key name '${newName}'`)
    }

    const oldDatastoreName = dsName(oldName)
    const newDatastoreName = dsName(newName)
    const oldInfoName = dsInfoName(oldName)
    const newInfoName = dsInfoName(newName)

    const exists = await this.components.datastore.has(newDatastoreName, options)

    if (exists) {
      throw new InvalidParametersError(`Key '${newName}' already exists`)
    }

    const pem = await this.components.datastore.get(oldDatastoreName, options)
    const res = await this.components.datastore.get(oldInfoName, options)

    const keyInfo = JSON.parse(uint8ArrayToString(res))
    keyInfo.name = newName

    const batch = this.components.datastore.batch()
    batch.put(newDatastoreName, pem)
    batch.put(newInfoName, uint8ArrayFromString(JSON.stringify(keyInfo)))
    batch.delete(oldDatastoreName)
    batch.delete(oldInfoName)

    await batch.commit(options)
  }

  /**
   * Rotate keychain password and re-encrypt all associated keys
   */
  async rotateKeychainPass (password: string, options?: AbortOptions): Promise<void> {
    if (typeof password !== 'string') {
      throw new InvalidParametersError(`Invalid new pass type '${typeof password}'`)
    }

    if (password.length < MIN_PASS_LENGTH) {
      throw new InvalidParametersError(`Invalid pass length ${password.length}, must be at least ${MIN_PASS_LENGTH}`)
    }

    this.log('recreating keychain')

    if (this.key == null) {
      throw new NotStartedError()
    }

    const oldKey = this.key
    const newKey = await this.generateSaltedKey(password)

    const batch = this.components.datastore.batch()

    for await (const info of this.listKeys(options)) {
      const key = await this._exportKey(info.name, oldKey)

      // Update stored key
      await this._importKey(info.name, key, newKey, batch, options)
    }

    await batch.commit(options)

    this.key = newKey

    this.log('keychain reconstructed')
  }
}
