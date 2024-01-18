import type { Controller } from 'ipfsd-ctl'

export async function addContentToKuboNode (kuboNode: Controller<'go'>, content: any) {
  return await kuboNode.api.add(content, {
    cidVersion: 1,
    pin: false
  })
}
