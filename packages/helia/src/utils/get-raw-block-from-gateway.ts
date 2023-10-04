import type { CID } from 'multiformats/cid'

export async function getRawBlockFromGateway (url: string | URL, cid: CID, signal?: AbortSignal): Promise<Uint8Array> {
  const gwUrl = new URL(url)

  gwUrl.pathname = `/ipfs/${cid.toString()}`
  gwUrl.search = '?format=raw' // necessary as not every gateway supports dag-cbor, but every should support sending raw block as-is
  try {
    const res = await fetch(gwUrl.toString(), {
      signal,
      headers: {
        // also set header, just in case ?format= is filtered out by some reverse proxy
        Accept: 'application/vnd.ipld.raw'
      },
      cache: 'force-cache'
    })
    if (!res.ok) {
      throw new Error(`unable to fetch raw block for CID ${cid} from gateway ${gwUrl.toString()}`)
    }
    return new Uint8Array(await res.arrayBuffer())
  } catch (cause) {
    console.error('cause', cause)
    throw new Error(`unable to fetch raw block for CID ${cid}`)
  }
}
