import { InvalidParametersError } from '@libp2p/interface'
import { CID } from 'multiformats'
import { base36 } from 'multiformats/bases/base36'
import { base64 } from 'multiformats/bases/base64'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { withArrayBuffer as uint8ArrayWithArrayBuffer } from 'uint8arrays/with-array-buffer'
import { PrivateKeyMessage, PublicKeyMessage } from '../keychain/keys.ts'
import { decodeDer, encodeBitString, encodeInteger, encodeSequence } from './der.ts'
import type { Cipher, CryptoKeyImplementation, PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { MultihashDigest } from 'multiformats'

export const MAX_RSA_KEY_SIZE = 8192

class RSAPublicKey implements PublicKey {
  public type = 'RSA'
  public code = 0
  public _raw?: Uint8Array<ArrayBuffer>
  private digest: MultihashDigest<0x012>
  private jwk: JsonWebKey

  constructor (jwk: JsonWebKey, digest: MultihashDigest<0x012>) {
    if (rsaKeySize(jwk) > MAX_RSA_KEY_SIZE) {
      throw new InvalidParametersError('Key size is too large')
    }

    this.jwk = jwk
    this.digest = digest
  }

  toMultihash (): MultihashDigest<0x012> {
    return this.digest
  }

  toCID (): CID<unknown, 0x72, 0x12, 1> {
    return CID.createV1(0x72, this.toMultihash())
  }

  toString (): string {
    return this.toCID().toString(base36)
  }

  toProtobuf (): Uint8Array<ArrayBuffer> {
    return PublicKeyMessage.encode({
      Type: this.code,
      Data: jwkToPkix(this.jwk)
    })
  }

  async verify (message: Uint8Array, signature: Uint8Array, options?: AbortOptions): Promise<boolean> {
    const key = await crypto.subtle.importKey('jwk', this.jwk, {
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
  public publicKey: PublicKey
  private readonly jwk: JsonWebKey

  constructor (jwk: JsonWebKey, publicKey: PublicKey) {
    if (rsaKeySize(jwk) > MAX_RSA_KEY_SIZE) {
      throw new InvalidParametersError('Key size is too large')
    }

    this.jwk = jwk
    this.publicKey = publicKey
  }

  toProtobuf (): Uint8Array<ArrayBuffer> {
    return PrivateKeyMessage.encode({
      Type: this.code,
      Data: jwkToPkcs1(this.jwk)
    })
  }

  async sign (message: Uint8Array, options?: AbortOptions): Promise<Uint8Array<ArrayBuffer>> {
    const key = await crypto.subtle.importKey('jwk', this.jwk, {
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

export interface CreateRSAPrivateKeyOptions extends AbortOptions, Record<string, any> {
  /**
   * The key size
   *
   * @default 2048
   */
  bits?: number
}

class RSACrypto implements CryptoKeyImplementation {
  public type = 'RSA'
  public code = 0

  async createPrivateKey (options?: CreateRSAPrivateKeyOptions): Promise<PrivateKey> {
    const keypair = await crypto.subtle.generateKey({
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: options?.bits ?? 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: {
        name: 'SHA-256'
      }
    }, true, ['sign', 'verify'])

    const jwkPrivateKey = await crypto.subtle.exportKey('jwk', keypair.privateKey)
    const jwkPublicKey = await crypto.subtle.exportKey('jwk', keypair.publicKey)
    const digest = await publicKeyId(jwkPublicKey)

    options?.signal?.throwIfAborted()

    return new RSAPrivateKey(jwkPrivateKey, new RSAPublicKey(jwkPublicKey, digest))
  }

  async publicKeyFromProtobuf (data: Uint8Array, options?: AbortOptions): Promise<PublicKey> {
    const jwk = pkixMessageToJwk(data)
    const digest = await publicKeyId(jwk)

    options?.signal?.throwIfAborted()

    return new RSAPublicKey(jwk, digest)
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
    if (!pem.includes('-----BEGIN ENCRYPTED PRIVATE KEY-----')) {
      const decoded = base64.decode(`${pem}`)
      const salt = decoded.subarray(0, 16)
      const iv = decoded.subarray(16, 16 + 12)
      const cypherText = decoded.subarray(16 + 12)
      const plainText = await cipher.decrypt(salt, iv, cypherText, options)
      const pb = PrivateKeyMessage.decode(plainText)

      if (pb.Type !== 0) {
        throw new Error('Incorrect type in protobuf message')
      }

      if (pb.Data == null) {
        throw new Error('Data field was missing from protobuf message')
      }

      const pkcs1Decoded = decodeDer(pb.Data)
      const privateKeyJwk = pkcs1MessageToJwk(pkcs1Decoded)
      const publicKeyJwk = privateJWKToPublicJWK(privateKeyJwk)
      const digest = await publicKeyId(publicKeyJwk)

      options?.signal?.throwIfAborted()

      return new RSAPrivateKey(privateKeyJwk, new RSAPublicKey(publicKeyJwk, digest))
    }

    pem = pem.replaceAll('-----BEGIN ENCRYPTED PRIVATE KEY-----', '')
    pem = pem.replaceAll('-----END ENCRYPTED PRIVATE KEY-----', '')
    pem = pem.replaceAll('\r', '')
    pem = pem.replaceAll('\n', '')

    const decoded = base64.decode(`m${pem}`)
    const der = decodeDer(decoded)

    // this looks fragile but DER is a canonical format so we are safe to have
    // deep property chains like this
    const salt = der[0][1][0][1][0]
    const iterations = toNumber(der[0][1][0][1][1])
    const keyLength = toNumber(der[0][1][0][1][2])
    const iv = der[0][1][0][1][4][1]
    const keyData = der[0][1][0][1][4][2]

    const plainText = await cipher.decrypt(salt, iv, keyData, {
      iterations,
      keyLength: keyLength * 8,
      hash: 'SHA-512',
      algorithm: 'AES-CBC',
      signal: options?.signal
    })

    const keyWrapper = decodeDer(plainText)
    const pkcs1 = keyWrapper[2]

    const pkcs1Decoded = decodeDer(pkcs1)
    const privateKeyJwk = pkcs1MessageToJwk(pkcs1Decoded)

    const publicKeyJwk = privateJWKToPublicJWK(privateKeyJwk)
    const digest = await publicKeyId(publicKeyJwk)

    options?.signal?.throwIfAborted()

    return new RSAPrivateKey(privateKeyJwk, new RSAPublicKey(publicKeyJwk, digest))
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
    alg: 'RS256',
    kty: 'RSA',
    n: uint8ArrayToString(message[1], 'base64url'),
    e: uint8ArrayToString(message[2], 'base64url'),
    ext: true,
    key_ops: [
      'sign'
    ],
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

const RSA_ALGORITHM_IDENTIFIER = Uint8Array.from([
  0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05, 0x00
])

function jwkToPkix (jwk: JsonWebKey): Uint8Array<ArrayBuffer> {
  if (jwk.n == null || jwk.e == null) {
    throw new InvalidParametersError('JWK public key was missing components')
  }

  const subjectPublicKeyInfo = encodeSequence([
    RSA_ALGORITHM_IDENTIFIER,
    encodeBitString(
      encodeSequence([
        encodeInteger(uint8ArrayFromString(jwk.n, 'base64url')),
        encodeInteger(uint8ArrayFromString(jwk.e, 'base64url'))
      ])
    )
  ])

  return subjectPublicKeyInfo.subarray()
}

function pkixMessageToJwk (message: Uint8Array): JsonWebKey {
  const cert = decodeDer(message)

  if (cert.length < 2 || cert[0]?.[0] !== '1.2.840.113549.1.1.1') {
    throw new Error('PKIX certificate was invalid')
  }

  const keys = decodeDer(cert[1])

  return {
    kty: 'RSA',
    n: uint8ArrayToString(
      keys[0],
      'base64url'
    ),
    e: uint8ArrayToString(
      keys[1],
      'base64url'
    )
  }
}

function privateJWKToPublicJWK (jwk: JsonWebKey): JsonWebKey {
  return {
    key_ops: ['verify'],
    ext: true,
    alg: 'RS256',
    kty: 'RSA',
    n: jwk.n,
    e: 'AQAB'
  }
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

async function publicKeyId (jwk: JsonWebKey): Promise<MultihashDigest<0x12>> {
  const data = PublicKeyMessage.encode({
    Type: 0,
    Data: jwkToPkix(jwk)
  })

  return sha256.digest(data)
}
