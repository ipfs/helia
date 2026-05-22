import type { PrivateKey, PublicKey } from './index.ts'
import type { AbortOptions } from 'abort-error'

export interface KeyInfo {
  /**
   * The hash of the key
   */
  id: string

  /**
   * The key name
   */
  name: string

  /**
   * The key type
   */
  type?: 'Ed25519' | 'RSA' | string
}

export interface GenerateKeyOptions extends AbortOptions, Record<string, any> {
  /**
   * The type of key to generate
   *
   * @default 'Ed25519'
   */
  type?: 'Ed25519' | 'RSA' | string
}

export interface Keychain {
  /**
   * Create a key of the passed type and store it under the specified name. A
   * cryptography implementation must be configured for the key type (defaults
   * to Ed25519).
   */
  generateKey (name: string, options?: AbortOptions & Record<string, any>): Promise<PrivateKey>

  /**
   * Import a new private key.
   *
   * The `type` parameter must match a supported cryptography implementation.
   *
   * The default supported key types are `Ed25519` and `RSA`, others may be
   * added through configuration.
   *
   * @example
   *
   * ```TypeScript
   * const key = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])
   * const raw = await crypto.subtle.exportKey('raw', key)
   * await helia.keychain.importKey('my-key', 'Ed25519', raw)
   * ```
   */
  importKey(name: string, key: PrivateKey, options?: AbortOptions): Promise<PrivateKey>

  /**
   * Export an existing private key.
   *
   * @example
   *
   * ```TypeScript
   * const raw = await helia.exportKey('my-key')
   * const key = await crypto.subtle.importKey('raw', raw, {
   *   name: 'Ed25519'
   * }, true, ['sign', 'verify'])
   * ```
   */
  exportKey(name: string, options?: AbortOptions): Promise<PrivateKey>

  /**
   * Removes a key from the keychain.
   *
   * @example
   *
   * ```TypeScript
   * await helia.keychain.removeKey('keyTest')
   * ```
   */
  removeKey(name: string, options?: AbortOptions): Promise<void>

  /**
   * Rename a key in the keychain. This is done in a batch commit with rollback
   * so errors thrown during the operation will not cause key loss.
   *
   * @example
   *
   * ```TypeScript
   * await helia.keychain.renameKey('oldName', 'newName')
   * ```
   */
  renameKey(oldName: string, newName: string, options?: AbortOptions): Promise<void>

  /**
   * List all the keys.
   *
   * @example
   *
   * ```TypeScript
   * for await (const name of helia.keychain.listKeys()) {
   *   // ...
   * }
   * ```
   */
  listKeys(options?: AbortOptions): AsyncGenerator<KeyInfo>

  /**
   * Re-encrypt all keys in the keychain using a crypto graphic key derived
   * from the password
   *
   * @example
   *
   * ```TypeScript
   * await helia.keychain.rotateKeychainPass('newPassword')
   * ```
   */
  rotateKeychainPass(password: string, options?: AbortOptions): Promise<void>

  /**
   * Attempts to load a public key from a serialized protobuf message conforming
   * to the `PublicKey` message.
   */
  loadPublicKeyFromProtobuf (buf: Uint8Array, options?: AbortOptions): Promise<PublicKey>
}
