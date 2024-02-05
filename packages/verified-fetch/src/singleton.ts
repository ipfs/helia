import { createVerifiedFetch } from './index.js'
import type { Resource, VerifiedFetch, VerifiedFetchInit } from './index.js'

let impl: VerifiedFetch | undefined

export const verifiedFetch: VerifiedFetch = async function verifiedFetch (resource: Resource, options?: VerifiedFetchInit): Promise<Response> {
  if (impl == null) {
    impl = await createVerifiedFetch()
  }

  return impl(resource, options)
}

verifiedFetch.start = async function () {
  await impl?.start()
}

verifiedFetch.stop = async function () {
  await impl?.stop()
}
