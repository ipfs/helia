import { DelegatedHTTPRouter } from './delegated-routing-router.ts'
import { delegatedHTTPRoutingDefaults } from './utils/delegated-http-routing-defaults.ts'
import type { DelegatedRoutingV1HttpApiClientInit } from '@helia/delegated-routing-v1-http-api-client'
import type { Router } from '@helia/interface'

export { delegatedHTTPRoutingDefaults }
export type { DelegatedRoutingV1HttpApiClientInit }

/**
 * Creates a Helia Router that connects to an endpoint that supports the [Delegated Routing V1 HTTP API](https://specs.ipfs.tech/routing/http-routing-v1/) spec.
 */
export function delegatedHTTPRouter (init: DelegatedRoutingV1HttpApiClientInit): (components: any) => Router {
  return (components: any) => new DelegatedHTTPRouter(components, delegatedHTTPRoutingDefaults(init))
}
