import { CarReader } from '@ipld/car/reader'
import loadFixtures from 'aegir/fixtures'

export async function loadCarFixture (path: string): Promise<{ reader: CarReader, bytes: Uint8Array }> {
  const carBytes = loadFixtures(path)
  const carBytesAsUint8Array = new Uint8Array(carBytes)
  return {
    reader: await CarReader.fromBytes(carBytesAsUint8Array),
    bytes: carBytesAsUint8Array
  }
}
