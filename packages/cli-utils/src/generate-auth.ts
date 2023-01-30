import { EdKeypair, build, encode } from '@ucans/ucans'

export async function generateAuth (serverKey: string): Promise<string> {
  const issuer = EdKeypair.fromSecretKey(serverKey, {
    format: 'base64url'
  })

  const userKey = await EdKeypair.create()

  const clientUcan = await build({
    issuer,
    audience: userKey.did(),
    expiration: (Date.now() / 1000) + (60 * 60 * 24),
    capabilities: [{
      with: { scheme: 'service', hierPart: '/cat' },
      can: { namespace: 'service', segments: ['GET'] }
    }]
  })

  return encode(clientUcan)
}
