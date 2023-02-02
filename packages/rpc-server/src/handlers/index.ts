import type { RPCServerConfig, Service } from '../index.js'
import { createInfo } from './info.js'
import { createAuthorizationGet } from './authorization/get.js'
import { createBlockstoreDelete } from './blockstore/delete.js'
import { createBlockstoreGet } from './blockstore/get.js'
import { createBlockstoreHas } from './blockstore/has.js'
import { createBlockstorePut } from './blockstore/put.js'
import { createBlockstoreDeleteMany } from './blockstore/delete-many.js'
import { createBlockstoreGetMany } from './blockstore/get-many.js'
import { createBlockstoreBatch } from './blockstore/batch.js'
import { createBlockstoreClose } from './blockstore/close.js'
import { createBlockstoreOpen } from './blockstore/open.js'
import { createBlockstorePutMany } from './blockstore/put-many.js'
import { createBlockstoreQueryKeys } from './blockstore/query-keys.js'
import { createBlockstoreQuery } from './blockstore/query.js'

export function createServices (config: RPCServerConfig): Record<string, Service> {
  const services: Record<string, Service> = {
    '/authorization/get': createAuthorizationGet(config),
    '/blockstore/batch': createBlockstoreBatch(config),
    '/blockstore/close': createBlockstoreClose(config),
    '/blockstore/delete-many': createBlockstoreDeleteMany(config),
    '/blockstore/delete': createBlockstoreDelete(config),
    '/blockstore/get-many': createBlockstoreGetMany(config),
    '/blockstore/get': createBlockstoreGet(config),
    '/blockstore/has': createBlockstoreHas(config),
    '/blockstore/open': createBlockstoreOpen(config),
    '/blockstore/put-many': createBlockstorePutMany(config),
    '/blockstore/put': createBlockstorePut(config),
    '/blockstore/query-keys': createBlockstoreQueryKeys(config),
    '/blockstore/query': createBlockstoreQuery(config),
    '/info': createInfo(config)
  }

  return services
}
