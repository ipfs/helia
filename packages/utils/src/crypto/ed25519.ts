import { InvalidParametersError, InvalidPrivateKeyError } from '@libp2p/interface'
import { CID } from 'multiformats'
import { base58btc } from 'multiformats/bases/base58'
import { base64 } from 'multiformats/bases/base64'
import { identity } from 'multiformats/hashes/identity'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8arrayFromString } from 'uint8arrays/from-string'
import { toString as uint8arrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer as uint8ArrayWithArrayBuffer } from 'uint8arrays/with-array-buffer'
import { PrivateKeyMessage, PublicKeyMessage } from '../keychain/keys.ts'
import type { Cipher, CryptoKeyImplementation, PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from 'abort-error'
import type { MultihashDigest } from 'multiformats'

const PRIVATE_KEY_LENGTH = 32
const PUBLIC_KEY_LENGTH = 32

class Ed25519PublicKey implements PublicKey {
  public type = 'Ed25519'
  public code = 1
  public raw: ArrayBuffer

  constructor (raw: ArrayBuffer) {
    if (raw.byteLength > PUBLIC_KEY_LENGTH) {
      throw new InvalidParametersError(`Public key was too long ${raw.byteLength} > ${PUBLIC_KEY_LENGTH}`)
    }

    this.raw = raw
  }

  toMultihash (): MultihashDigest<0x00> {
    return identity.digest(this.toProtobuf())
  }

  toCID (): CID<unknown, 0x72, 0x00, 1> {
    return CID.createV1(0x72, this.toMultihash())
  }

  toString (): string {
    return base58btc.encode(this.toMultihash().bytes).substring(1)
  }

  toProtobuf (): Uint8Array<ArrayBuffer> {
    return PublicKeyMessage.encode({
      Type: this.code,
      Data: new Uint8Array(this.raw.slice())
    })
  }

  async verify (message: Uint8Array, signature: Uint8Array, options?: AbortOptions): Promise<boolean> {
    const key = await crypto.subtle.importKey('raw', this.raw, { name: 'Ed25519' }, false, ['verify'])
    const isValid = await crypto.subtle.verify({ name: 'Ed25519' }, key, uint8ArrayWithArrayBuffer(signature), uint8ArrayWithArrayBuffer(message))
    options?.signal?.throwIfAborted()

    return isValid
  }
}

class Ed25519PrivateKey implements PrivateKey {
  public type = 'Ed25519'
  public code = 1
  public raw: ArrayBuffer
  public publicKey: Ed25519PublicKey

  constructor (raw: ArrayBuffer, publicKey: Ed25519PublicKey) {
    if (raw.byteLength < PRIVATE_KEY_LENGTH) {
      throw new InvalidPrivateKeyError(`Incorrect key length, got ${raw.byteLength} expected ${PRIVATE_KEY_LENGTH}`)
    }

    this.raw = truncateKey(raw)
    this.publicKey = publicKey
  }

  toProtobuf (): Uint8Array<ArrayBuffer> {
    return PrivateKeyMessage.encode({
      Type: this.code,
      Data: uint8ArrayConcat([
        new Uint8Array(this.raw.slice()),
        new Uint8Array(this.publicKey.raw.slice())
      ], 64)
    })
  }

  async sign (message: Uint8Array, options?: AbortOptions): Promise<Uint8Array<ArrayBuffer>> {
    const key = await crypto.subtle.importKey('jwk', {
      crv: 'Ed25519',
      kty: 'OKP',
      x: uint8arrayToString(new Uint8Array(this.publicKey.raw), 'base64url'),
      d: uint8arrayToString(new Uint8Array(this.raw), 'base64url'),
      ext: true,
      key_ops: ['sign']
    }, {
      name: 'Ed25519'
    }, true, ['sign'])
    const sig = await crypto.subtle.sign({
      name: 'Ed25519'
    }, key, uint8ArrayWithArrayBuffer(message))
    options?.signal?.throwIfAborted()

    return new Uint8Array(sig, 0, sig.byteLength)
  }
}

class Ed25519Crypto implements CryptoKeyImplementation {
  type = 'Ed25519'
  code = 1

  async createPrivateKey (options?: AbortOptions & Record<string, any>): Promise<PrivateKey> {
    const key = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])
    const buf = await crypto.subtle.exportKey('pkcs8', key.privateKey)

    // raw key is last 32 bytes of pkcs8 wrapper
    const raw = new Uint8Array(buf, buf.byteLength - PRIVATE_KEY_LENGTH, PRIVATE_KEY_LENGTH).slice()
    return new Ed25519PrivateKey(raw.buffer, await derivePublicKey(raw.buffer, options))
  }

  async publicKeyFromProtobuf (key: Uint8Array, options?: AbortOptions): Promise<PublicKey> {
    const publicKey = new Ed25519PublicKey(uint8ArrayWithArrayBuffer(key).slice().buffer)
    options?.signal?.throwIfAborted()

    return publicKey
  }

  async serialize (key: PrivateKey, cipher: Cipher, options?: AbortOptions): Promise<string> {
    const buf = key.toProtobuf()
    const result = await cipher.encrypt(buf, options)

    return base64.encode(uint8ArrayConcat([
      result.salt,
      result.iv,
      result.cipherText
    ], result.salt.byteLength + result.iv.byteLength + result.cipherText.byteLength))
  }

  async deserialize (pem: string, cipher: Cipher, options?: AbortOptions): Promise<PrivateKey> {
    const decoded = base64.decode(pem)
    const salt = decoded.subarray(0, 16)
    const iv = decoded.subarray(16, 16 + 12)
    const cipherText = decoded.subarray(16 + 12)

    const plainText = await cipher.decrypt(salt, iv, cipherText)
    const pb = PrivateKeyMessage.decode(plainText)

    if (pb.Data == null) {
      throw new InvalidPrivateKeyError('Protobuf message did not contain private key')
    }

    const raw = pb.Data.slice(0, 32).buffer
    return new Ed25519PrivateKey(raw, await derivePublicKey(raw, options))
  }
}

export function ed25519Crypto (): CryptoKeyImplementation {
  return new Ed25519Crypto()
}

/**
 * for legacy reasons the public key is sometimes appended to the private key so
 * truncate the Uint8Array to handle this case
 */
function truncateKey (input: ArrayBuffer): ArrayBuffer {
  const key = new ArrayBuffer(PRIVATE_KEY_LENGTH)
  const view = new Uint8Array(key)
  view.set(new Uint8Array(input, 0, PRIVATE_KEY_LENGTH))

  return key
}

async function derivePublicKey (raw: ArrayBuffer, options?: AbortOptions): Promise<Ed25519PublicKey> {
  let publicKey: ArrayBuffer

  // if the public key is appended to the private key, just return that
  if (raw.byteLength === 64) {
    publicKey = new Uint8Array(raw, PRIVATE_KEY_LENGTH).slice().buffer
  } else {
    const privateKey = truncateKey(raw)
    const pkcs8 = convertRawX25519KeyToPKCS(privateKey)
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, {
      name: 'Ed25519'
    }, true, ['sign'])

    const exported = await crypto.subtle.exportKey('jwk', key)

    if (exported.x == null) {
      throw new InvalidPrivateKeyError('Public key was missing from JWK export')
    }

    publicKey = uint8arrayFromString(exported.x ?? '', 'base64url').buffer
  }

  options?.signal?.throwIfAborted()

  return new Ed25519PublicKey(publicKey)
}

const PKCS8_HEADER = Uint8Array.from([
  48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4
])

function convertRawX25519KeyToPKCS (privateKey: ArrayBuffer): Uint8Array<ArrayBuffer> {
  return uint8ArrayConcat([
    PKCS8_HEADER,
    Uint8Array.from([privateKey.byteLength]),
    new Uint8Array(privateKey)
  ], PKCS8_HEADER.byteLength + 1 + privateKey.byteLength)
}
