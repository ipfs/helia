import drain from 'it-drain'
import { getFixtureDataAsyncIterable } from './get-fixture-data.js'
import type { Controller } from 'ipfsd-ctl'

export async function loadFixtureDataCar (controller: Controller<'go'>, path: string): Promise<void> {
  await drain(controller.api.dag.import(getFixtureDataAsyncIterable(path)))
}
