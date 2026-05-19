import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import { fromString as uint8arrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer as uint8ArrayWithArrayBuffer } from 'uint8arrays/with-array-buffer'
import type { CryptoKeyImplementation, PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { MultihashDigest } from 'multiformats'

class RSAPublicKey implements PublicKey {
  public type = 'RSA'
  public code = 0
  public raw: ArrayBuffer
  private digest: MultihashDigest

  constructor (raw: ArrayBuffer, digest: MultihashDigest) {
    this.raw = raw
    this.digest = digest
  }

  toMultihash (): MultihashDigest {
    return this.digest
  }

  toCID (): CID<unknown, 0x72> {
    return CID.createV1(0x72, this.toMultihash())
  }

  async verify (message: Uint8Array, signature: Uint8Array, options?: AbortOptions): Promise<boolean> {
    const key = await crypto.subtle.importKey('jwk', {
      key_ops: ['verify'],
      ext: true,
      alg: 'RS256',
      kty: 'RSA',
      n: uint8ArrayToString(new Uint8Array(this.raw), 'base64url'),
      e: 'AQAB'
    }, {
      name: 'RSASSA-PKCS1-v1_5',
      hash: {
        name: 'SHA-256'
      }
    }, false, ['verify'])
    const result = await crypto.subtle.verify({
      name: 'RSASSA-PKCS1-v1_5'
    }, key, uint8ArrayWithArrayBuffer(signature), uint8ArrayWithArrayBuffer(message))
    options?.signal?.throwIfAborted()

    return result
  }
}

class RSAPrivateKey implements PrivateKey {
  public type = 'RSA'
  public code = 0
  public raw: ArrayBuffer
  public publicKey: PublicKey

  constructor (raw: ArrayBuffer, publicKey: PublicKey) {
    this.raw = raw
    this.publicKey = publicKey
  }

  async sign (message: Uint8Array, options?: AbortOptions): Promise<Uint8Array<ArrayBuffer>> {
    const key = await crypto.subtle.importKey('pkcs8', this.raw, {
      name: 'RSASSA-PKCS1-v1_5',
      hash: {
        name: 'SHA-256'
      }
    }, false, ['sign'])
    const sig = await crypto.subtle.sign({
      name: 'RSASSA-PKCS1-v1_5'
    }, key, uint8ArrayWithArrayBuffer(message))
    options?.signal?.throwIfAborted()

    return new Uint8Array(sig, 0, sig.byteLength)
  }
}

class RSACrypto implements CryptoKeyImplementation {
  public type = 'RSA'
  public code = 0

  async createPrivateKey (options?: AbortOptions & Record<string, any>): Promise<PrivateKey> {
    const privateKey = await crypto.subtle.generateKey({
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: {
        name: 'SHA-256'
      }
    }, true, ['sign', 'verify'])
    const rawPrivateKey = await crypto.subtle.exportKey('pkcs8', privateKey.privateKey)
    const exported = await crypto.subtle.exportKey('jwk', privateKey.publicKey)
    const publicKey = uint8arrayFromString(exported.n ?? '', 'base64url')

    return new RSAPrivateKey(rawPrivateKey, new RSAPublicKey(publicKey.buffer, await sha256.digest(new Uint8Array(publicKey))))
  }

  async publicKeyFromArray (key: ArrayBuffer | Uint8Array, options?: AbortOptions): Promise<PublicKey> {
    const raw = key instanceof ArrayBuffer ? key : uint8ArrayWithArrayBuffer(key).buffer

    return new RSAPublicKey(raw, await sha256.digest(new Uint8Array(raw)))
  }

  async privateKeyFromArray (key: ArrayBuffer | Uint8Array, options?: AbortOptions): Promise<PrivateKey> {
    const raw = key instanceof ArrayBuffer ? key : uint8ArrayWithArrayBuffer(key).slice().buffer

    return new RSAPrivateKey(raw, await derivePublicKey(raw, options))
  }
}

export function rsaCrypto (): CryptoKeyImplementation {
  return new RSACrypto()
}

async function derivePublicKey (raw: ArrayBuffer, options?: AbortOptions): Promise<PublicKey> {
  const key = await crypto.subtle.importKey('pkcs8', raw, {
    name: 'RSASSA-PKCS1-v1_5',
    hash: {
      name: 'SHA-256'
    }
  }, true, ['sign'])
  options?.signal?.throwIfAborted()

  const exported = await crypto.subtle.exportKey('jwk', key)
  options?.signal?.throwIfAborted()

  const publicKey = uint8arrayFromString(exported.n ?? '', 'base64url')
  const digest = await sha256.digest(new Uint8Array(publicKey.buffer))

  return new RSAPublicKey(publicKey.buffer, digest)
}
