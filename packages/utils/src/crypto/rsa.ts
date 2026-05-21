import { InvalidParametersError } from '@libp2p/interface'
import { CID } from 'multiformats'
import { base64 } from 'multiformats/bases/base64'
import { sha256 } from 'multiformats/hashes/sha2'
import { fromString as uint8arrayFromString } from 'uint8arrays/from-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer as uint8ArrayWithArrayBuffer } from 'uint8arrays/with-array-buffer'
import { PrivateKeyMessage } from '../keychain/keys.ts'
import { decodeDer, encodeInteger, encodeSequence } from './der.ts'
import type { Cipher, CryptoKeyImplementation, PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { MultihashDigest } from 'multiformats'

export const MAX_RSA_KEY_SIZE = 8192

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
      /* spell-checker:disable-next-line */
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

  constructor (pkcs8: ArrayBuffer, publicKey: PublicKey) {
    this.raw = pkcs8
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

  async serialize (key: PrivateKey, cipher: Cipher): Promise<string> {
    const pkcs8 = await crypto.subtle.importKey('pkcs8', key.raw, {
      name: 'RSASSA-PKCS1-v1_5',
      hash: {
        name: 'SHA-256'
      }
    }, true, ['sign'])
    const jwk = await crypto.subtle.exportKey('jwk', pkcs8)
    const pkcs1 = jwkToPkcs1(jwk)

    const buf = PrivateKeyMessage.encode({
      Type: key.code,
      Data: pkcs1
    })

    const cipherText = await cipher.encrypt(buf)

    return base64.encode(cipherText)
  }

  async deserialize (pem: string, cipher: Cipher): Promise<PrivateKey> {
    if (!pem.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----')) {
      const decoded = base64.decode(`${pem}`)
      const salt = decoded.subarray(0, 16)
      const iv = decoded.subarray(16, 16 + 12)
      const cypherText = decoded.subarray(16 + 12)
      const plainText = await cipher.decrypt(salt, iv, cypherText)
      const pb = PrivateKeyMessage.decode(plainText)

      if (pb.Type !== 0) {
        throw new Error('Incorrect type in protobuf message')
      }

      if (pb.Data == null) {
        throw new Error('Data field was missing from protobuf message')
      }

      const pkcs1Decoded = decodeDer(pb.Data)
      const jwk = pkcs1MessageToJwk(pkcs1Decoded)

      if (rsaKeySize(jwk) > MAX_RSA_KEY_SIZE) {
        throw new InvalidParametersError('Key size is too large')
      }

      const importedJWK = await crypto.subtle.importKey('jwk', jwk, {
        name: 'RSASSA-PKCS1-v1_5',
        hash: {
          name: 'SHA-256'
        }
      }, true, ['sign'])
      const pkcs8 = await crypto.subtle.exportKey('pkcs8', importedJWK)
      const publicKey = uint8arrayFromString(jwk.n ?? '', 'base64url')

      return new RSAPrivateKey(pkcs8, new RSAPublicKey(publicKey.buffer, await sha256.digest(new Uint8Array(publicKey))))
    }

    pem = pem.replaceAll('-----BEGIN ENCRYPTED PRIVATE KEY-----', '')
    pem = pem.replaceAll('-----END ENCRYPTED PRIVATE KEY-----', '')
    pem = pem.replaceAll('\r', '')
    pem = pem.replaceAll('\n', '')

    const decoded = base64.decode(`m${pem}`)
    const der = decodeDer(decoded)

    const salt = der[0][1][0][1][0]
    const iterations = toNumber(der[0][1][0][1][1])
    const keyLength = toNumber(der[0][1][0][1][2])
    const iv = der[0][1][0][1][4][1]
    const keyData = der[0][1][0][1][4][2]

    const plainText = await cipher.decrypt(salt, iv, keyData, {
      iterations,
      keyLength: keyLength * 8,
      hash: 'SHA-512',
      algorithm: 'AES-CBC'
    })

    const keyWrapper = decodeDer(plainText)
    const pkcs1 = keyWrapper[2]

    const pkcs1Decoded = decodeDer(pkcs1)
    const jwk = pkcs1MessageToJwk(pkcs1Decoded)

    if (rsaKeySize(jwk) > MAX_RSA_KEY_SIZE) {
      throw new InvalidParametersError('Key size is too large')
    }

    const importedJWK = await crypto.subtle.importKey('jwk', jwk, {
      name: 'RSASSA-PKCS1-v1_5',
      hash: {
        name: 'SHA-256'
      }
    }, true, ['sign'])
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', importedJWK)
    const publicKey = uint8arrayFromString(jwk.n ?? '', 'base64url')

    return new RSAPrivateKey(pkcs8, new RSAPublicKey(publicKey.buffer, await sha256.digest(new Uint8Array(publicKey))))
  }
}

export function rsaCrypto (): CryptoKeyImplementation {
  return new RSACrypto()
}

function toNumber (buf: Uint8Array): number {
  if (buf.length === 0) {
    return 0
  }

  const str = [...buf]
    .map(n => n.toString(16).padStart(2, '0'))
    .join('')

  return parseInt(str, 16)
}

/**
 * Convert private key PKCS#1 in ASN1 DER format to JWK
 */
function pkcs1MessageToJwk (message: Uint8Array[]): JsonWebKey {
  return {
    kty: 'RSA',
    n: uint8ArrayToString(message[1], 'base64url'),
    e: uint8ArrayToString(message[2], 'base64url'),
    d: uint8ArrayToString(message[3], 'base64url'),
    p: uint8ArrayToString(message[4], 'base64url'),
    q: uint8ArrayToString(message[5], 'base64url'),
    dp: uint8ArrayToString(message[6], 'base64url'),
    dq: uint8ArrayToString(message[7], 'base64url'),
    qi: uint8ArrayToString(message[8], 'base64url')
  }
}

/**
 * Convert a JWK private key into PKCS#1 in ASN1 DER format
 */
function jwkToPkcs1 (jwk: JsonWebKey): Uint8Array<ArrayBuffer> {
  if (jwk.n == null || jwk.e == null || jwk.d == null || jwk.p == null || jwk.q == null || jwk.dp == null || jwk.dq == null || jwk.qi == null) {
    throw new InvalidParametersError('JWK was missing components')
  }

  return encodeSequence([
    encodeInteger(Uint8Array.from([0])),
    encodeInteger(uint8ArrayFromString(jwk.n, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.e, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.d, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.p, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.q, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.dp, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.dq, 'base64url')),
    encodeInteger(uint8ArrayFromString(jwk.qi, 'base64url'))
  ]).subarray()
}

export function rsaKeySize (jwk: JsonWebKey): number {
  if (jwk.kty !== 'RSA') {
    throw new InvalidParametersError('Invalid key type')
  } else if (jwk.n == null) {
    throw new InvalidParametersError('Invalid key modulus')
  }
  const modulus = uint8ArrayFromString(jwk.n, 'base64url')
  return modulus.length * 8
}
