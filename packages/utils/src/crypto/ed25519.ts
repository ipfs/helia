import { CID } from 'multiformats'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8arrayFromString } from 'uint8arrays/from-string'
import { toString as uint8arrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer as uint8ArrayWithArrayBuffer } from 'uint8arrays/with-array-buffer'
import type { CryptoKeyImplementation, PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from 'abort-error'
import type { MultihashDigest } from 'multiformats'

class Ed25519PublicKey implements PublicKey {
  public type = 'Ed25519'
  public code = 1
  public raw: ArrayBuffer

  constructor (raw: ArrayBuffer) {
    this.raw = raw
  }

  toMultihash (): MultihashDigest {
    return identity.digest(new Uint8Array(this.raw))
  }

  toCID (): CID<unknown, 0x72> {
    return CID.createV1(0x72, this.toMultihash())
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
  public publicKey: PublicKey

  constructor (raw: ArrayBuffer, publicKey: PublicKey) {
    this.raw = raw
    this.publicKey = publicKey
  }

  async sign (message: Uint8Array, options?: AbortOptions): Promise<Uint8Array<ArrayBuffer>> {
    const privateKey = truncateKey(this.raw)

    const key = await crypto.subtle.importKey('jwk', {
      crv: 'Ed25519',
      kty: 'OKP',
      // x: uint8arrayToString(privateKey.subarray(32), 'base64url'),
      d: uint8arrayToString(new Uint8Array(privateKey), 'base64url'),
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
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return new Ed25519PrivateKey(bytes.buffer, await derivePublicKey(bytes.buffer, options))
  }

  async publicKeyFromArray (key: ArrayBuffer | Uint8Array, options?: AbortOptions): Promise<PublicKey> {
    const publicKey = new Ed25519PublicKey(key instanceof ArrayBuffer ? key : uint8ArrayWithArrayBuffer(key).buffer)
    options?.signal?.throwIfAborted()

    return publicKey
  }

  async privateKeyFromArray (key: ArrayBuffer | Uint8Array, options?: AbortOptions): Promise<PrivateKey> {
    const raw = key instanceof ArrayBuffer ? key : uint8ArrayWithArrayBuffer(key).buffer

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
  const key = new ArrayBuffer(32)
  const view = new Uint8Array(key)
  view.set(new Uint8Array(input, 0, 32))

  return key
}

async function derivePublicKey (raw: ArrayBuffer, options?: AbortOptions): Promise<PublicKey> {
  let publicKey: ArrayBuffer

  // if the public key is appended to the private key, just return that
  if (raw.byteLength === 64) {
    publicKey = new Uint8Array(raw, 32).slice().buffer
  } else {
    const privateKey = truncateKey(raw)

    const key = await crypto.subtle.importKey('jwk', {
      crv: 'Ed25519',
      kty: 'OKP',
      // x: uint8arrayToString(privateKey.subarray(32), 'base64url'),
      d: uint8arrayToString(new Uint8Array(privateKey), 'base64url'),
      ext: true,
      key_ops: ['sign']
    }, {
      name: 'Ed25519'
    }, true, ['sign'])
    options?.signal?.throwIfAborted()

    const exported = await crypto.subtle.exportKey('jwk', key)
    options?.signal?.throwIfAborted()

    publicKey = uint8arrayFromString(exported.x ?? '', 'base64url').buffer
  }

  return new Ed25519PublicKey(publicKey)
}
