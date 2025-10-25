import { CID } from 'multiformats/cid'
import { IPNSPublisher } from './ipns/publisher.ts'
import { IPNSRepublisher } from './ipns/republisher.ts'
import { IPNSResolver } from './ipns/resolver.ts'
import { localStore } from './local-store.js'
import { helia } from './routing/helia.js'
import { localStoreRouting } from './routing/local-store.ts'
import type { IPNSComponents, IPNS as IPNSInterface, IPNSOptions, IPNSPublishResult, IPNSRefreshResult, IPNSResolveResult, PublishOptions, RefreshOptions, ResolveOptions } from './index.js'
import type { LocalStore } from './local-store.js'
import type { IPNSRouting } from './routing/index.js'
import type { AbortOptions, PeerId, PublicKey, Startable } from '@libp2p/interface'
import type { MultihashDigest } from 'multiformats/hashes/interface'

export class IPNS implements IPNSInterface, Startable {
  public readonly routers: IPNSRouting[]
  private readonly publisher: IPNSPublisher
  private readonly republisher: IPNSRepublisher
  private readonly resolver: IPNSResolver
  private readonly localStore: LocalStore
  private started: boolean

  constructor (components: IPNSComponents, init: IPNSOptions = {}) {
    this.localStore = localStore(components.datastore, components.logger.forComponent('helia:ipns:local-store'))
    this.started = components.libp2p.status === 'started'

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

  async publish (keyName: string, value: CID | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId | string, options: PublishOptions = {}): Promise<IPNSPublishResult> {
    return this.publisher.publish(keyName, value, options)
  }

  async resolve (key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: ResolveOptions = {}): Promise<IPNSResolveResult> {
    return this.resolver.resolve(key, options)
  }

  async unpublish (keyName: string, options?: AbortOptions): Promise<void> {
    return this.publisher.unpublish(keyName, options)
  }

  async refresh(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: RefreshOptions = {}): Promise<IPNSRefreshResult> {
    return this.republisher.refresh(key, options)
  }

  async unrefresh(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: AbortOptions = {}): Promise<void> {
    return this.republisher.unrefresh(key, options)
  }
}
