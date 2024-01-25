import type { ResolveDnsLinkProgressEvents, ResolveProgressEvents } from '@helia/ipns'
import type { GetEvents } from '@helia/unixfs'
import type { AbortOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

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

export type BubbledProgressEvents =
  // unixfs
  GetEvents |
  // ipns
  ResolveProgressEvents | ResolveDnsLinkProgressEvents

export interface CidDetail {
  cid: string
  path: string
}

export interface CidDetailError extends CidDetail {
  error: Error
}

export type VerifiedFetchProgressEvents =
  ProgressEvent<'verified-fetch:request:start', CidDetail> |
  ProgressEvent<'verified-fetch:request:info', string> |
  ProgressEvent<'verified-fetch:request:progress:chunk', CidDetail> |
  ProgressEvent<'verified-fetch:request:end', CidDetail> |
  ProgressEvent<'verified-fetch:request:error', CidDetailError>

/**
 * The second argument of the `verifiedFetch` function.
 */
export interface VerifiedFetchOptions extends Omit<RequestInit, 'signal'>, AbortOptions, ProgressOptions<BubbledProgressEvents | VerifiedFetchProgressEvents> {
}

export interface ParsedUrlStringResults {
  protocol: string
  path: string
  cid: CID
  query: Record<string, string>
}
