import type { Controller } from 'ipfsd-ctl'

export async function addContentToKuboNode (kuboNode: Controller<'go'>, content: any): Promise<ReturnType<typeof kuboNode['api']['add']>> {
  return kuboNode.api.add(content, {
    cidVersion: 1,
    pin: false
  })
}
