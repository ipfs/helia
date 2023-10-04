import { getGatewayBlockProvider } from './byte-provider-gateway.js'
import type { ByteProvider } from '@helia/interface/blocks'

export function getDefaultByteProviders (): ByteProvider[] {
  return [
    getGatewayBlockProvider('https://dweb.link'), // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
    getGatewayBlockProvider('https://cf-ipfs.com'), // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
    getGatewayBlockProvider('https://4everland.io'), // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
    getGatewayBlockProvider('https://w3s.link'), // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
    getGatewayBlockProvider('https://cloudflare-ipfs.com') // 2023-10-03: IPNS, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  ]
}
