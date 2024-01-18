import type { Controller } from 'ipfsd-ctl'

export async function importContentToKuboNode (kuboNode: Controller<'go'>, path: Parameters<Controller<'go'>['api']['refs']>[0]): Promise<ReturnType<Controller<'go'>['api']['refs']>> {
  return kuboNode.api.refs(path, {
    recursive: true
  })
}
