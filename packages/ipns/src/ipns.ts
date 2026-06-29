import { CID } from 'multiformats/cid'
import { IPNSPublisher } from './ipns/publisher.ts'
import { IPNSRepublisher } from './ipns/republisher.ts'
import { IPNSResolver } from './ipns/resolver.ts'
import { localStore } from './local-store.ts'
import { helia } from './routing/helia.ts'
import { localStoreRouting } from './routing/local-store.ts'
import { ipnsSelector } from './selector.ts'
import { normalizeKey, normalizeKeyName, normalizeValue, unmarshalIPNSRecord } from './utils.ts'
import { ipnsValidator } from './validator.ts'
import type { IPNSComponents, IPNS as IPNSInterface, IPNSOptions, RepublishResult, PublishOptions, PublishResult, RepublishOptions, ResolveOptions, ResolveResult } from './index.ts'
import type { LocalStore } from './local-store.ts'
import type { IPNSRouting } from './routing/index.ts'
import type { PublicKey } from '@helia/interface'
import type { AbortOptions, Libp2p, Startable } from '@libp2p/interface'
import type { ValidateFn, SelectFn } from '@libp2p/kad-dht'
import type { MultihashDigest } from 'multiformats/hashes/interface'

export class IPNS implements IPNSInterface, Startable {
  public readonly routers: IPNSRouting[]
  private readonly publisher: IPNSPublisher
  private readonly republisher: IPNSRepublisher
  private readonly resolver: IPNSResolver
  private readonly localStore: LocalStore
  private readonly components: IPNSComponents
  private started: boolean

  constructor (components: IPNSComponents, init: IPNSOptions = {}) {
    this.localStore = localStore(components.datastore, components.logger.forComponent('helia:ipns:local-store'))
    this.components = components
    this.started = false

    this.routers = [
      localStoreRouting(this.localStore),
      helia(components.routing),
      ...(init.routers ?? [])
    ]

    this.publisher = new IPNSPublisher(components, {
      ...init,
      routers: this.routers,
      localStore: this.localStore
    })
    this.resolver = new IPNSResolver(components, {
      ...init,
      routers: this.routers,
      localStore: this.localStore
    })
    this.republisher = new IPNSRepublisher(components, {
      ...init,
      resolver: this.resolver,
      routers: this.routers,
      localStore: this.localStore
    })

    // start republishing on Helia start
    components.events.addEventListener('start', this.start.bind(this))
    // stop republishing on Helia stop
    components.events.addEventListener('stop', this.stop.bind(this))

    if (this.started) {
      this.republisher.start()
    }

    for (const component of Object.values(this.components)) {
      if (isLibp2p(component)) {
        for (const service of Object.values(component.services)) {
          if (isKadDHT(service)) {
            // @ ts-expect-error https://github.com/libp2p/js-libp2p/pull/3506
            service.selectors.ipns = async (key: Uint8Array, values: Uint8Array[]): Promise<number> => {
              const records = await Promise.all(values.map(buf => unmarshalIPNSRecord(key, buf, this.components.keychain)))

              return ipnsSelector(key, records)
            }

            service.validators.ipns = async (key: Uint8Array, value: Uint8Array): Promise<void> => {
              const record = await unmarshalIPNSRecord(key, value, this.components.keychain)
              await ipnsValidator(record)
            }
          }
        }
      }
    }
  }

  start (): void {
    if (this.started) {
      return
    }

    this.started = true
    this.republisher.start()
  }

  stop (): void {
    if (!this.started) {
      return
    }

    this.started = false
    this.republisher.stop()
  }

  async publish (keyName: string, value: PublicKey | CID | MultihashDigest | string, options: PublishOptions = {}): Promise<PublishResult> {
    value = normalizeValue(value)

    return this.publisher.publish(keyName, value, options)
  }

  async * resolve (name: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options: ResolveOptions = {}): AsyncGenerator<ResolveResult> {
    const { digest } = normalizeKey(name)

    yield * this.resolver.resolve(digest, options)
  }

  async unpublish (keyName: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: AbortOptions): Promise<void> {
    keyName = normalizeKeyName(keyName)

    return this.publisher.unpublish(keyName, options)
  }

  async republish (keyName: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options: RepublishOptions = {}): Promise<RepublishResult> {
    keyName = normalizeKeyName(keyName)

    return this.republisher.republish(keyName, options)
  }
}

function isLibp2p (obj?: any): obj is Libp2p {
  return obj?.services != null
}

function isKadDHT (obj?: any): obj is { validators: Record<string, ValidateFn>, selectors: Record<string, SelectFn> } {
  return obj?.validators != null && obj?.selectors != null
}
