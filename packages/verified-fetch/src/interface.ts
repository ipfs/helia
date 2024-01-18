import type { CID } from 'multiformats/cid'

/**
 * Instead of passing a Helia instance, you can pass a list of gateways and routers, and a HeliaHTTP instance will be created for you.
 */
export interface CreateVerifiedFetchWithOptions {
  gateways: string[]
  routers?: string[]
}

/**
 * The types for the first argument of the `verifiedFetch` function.
 */
export type ResourceType = string | CID

/**
 * The second argument of the `verifiedFetch` function.
 */
export interface VerifiedFetchOptions extends RequestInit {
  signal?: AbortSignal
}
