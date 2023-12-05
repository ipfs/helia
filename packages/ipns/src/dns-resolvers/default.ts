import { MAX_RECURSIVE_DEPTH, recursiveResolveDnslink } from '../utils/dns.js'
import resolve from './resolver.js'
import type { DNSResolver, ResolveDnsLinkOptions } from '../index.js'

export function defaultResolver (): DNSResolver {
  return async (domain: string, options: ResolveDnsLinkOptions = {}): Promise<string> => {
    return recursiveResolveDnslink(domain, MAX_RECURSIVE_DEPTH, resolve, options)
  }
}
