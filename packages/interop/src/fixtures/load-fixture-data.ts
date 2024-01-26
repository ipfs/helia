import loadFixture from 'aegir/fixtures'
import drain from 'it-drain'
import type { Controller } from 'ipfsd-ctl'

export async function loadFixtureDataCar (controller: Controller, path: string): Promise<void> {
  const fixtureData = `src/fixtures/data/${path}`
  const buf = loadFixture(fixtureData)
  await drain(controller.api.dag.import([buf]))
}
