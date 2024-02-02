import { createVerifiedFetch } from './index.js'
import type { Resource, VerifiedFetch, VerifiedFetchInit } from './index.js'

interface VerifiedFetchSingleton extends VerifiedFetch {
  _impl?: VerifiedFetch
}

const singleton: VerifiedFetchSingleton = async function verifiedFetch (resource: Resource, options?: VerifiedFetchInit): Promise<Response> {
  if (singleton._impl == null) {
    singleton._impl = await createVerifiedFetch()
  }

  return singleton._impl(resource, options)
}
singleton.start = async function () {
  await singleton._impl?.stop()
}
singleton.stop = async function () {
  await singleton._impl?.stop()
}
const verifiedFetchSingleton: VerifiedFetch = singleton

export { verifiedFetchSingleton as verifiedFetch }
