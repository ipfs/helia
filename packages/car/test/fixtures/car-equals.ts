import { expect } from 'aegir/chai'
import type { CarReader } from '@ipld/car'
import type { CID } from 'multiformats/cid'

export enum CarEqualsSkip {
  roots = 'roots',
  blocks = 'blocks',
  blockOrder = 'blockOrder',
  version = 'version',
  header = 'header',
}
export interface CarEqualsOptions {
  skip?: CarEqualsSkip[]
  /**
   * If provided, the blocks with these CIDs will be skipped
   */
  skipBlocks?: CID[]
}
/**
 * A helper function to assert that two car files are identical
 *
 */
export async function carEquals (car1: CarReader, car2: CarReader, options?: CarEqualsOptions): Promise<void> {
  if (options?.skip?.includes(CarEqualsSkip.header) !== true) {
    expect(car1._header).to.deep.equal(car2._header)
  }
  if (options?.skip?.includes(CarEqualsSkip.roots) !== true) {
    expect(await car1.getRoots()).to.deep.equal(await car2.getRoots())
  }

  const blocks1 = []
  for await (const block of car1.blocks()) {
    blocks1.push(block)
  }
  const blocks2 = []
  for await (const block of car2.blocks()) {
    // if we should skip certain blocks, skip them
    if (options?.skipBlocks?.find((cid) => cid.equals(block.cid)) !== undefined) {
      continue
    }
    blocks2.push(block)
  }
  if (options?.skip?.includes(CarEqualsSkip.blocks) !== true) {
    if (options?.skip?.includes(CarEqualsSkip.blockOrder) !== true) {
      expect(blocks1).to.deep.equal(blocks2)
    } else {
      // check that the blocks are the same, but don't worry about the order
      expect(blocks1.length).to.equal(blocks2.length)
      for (const block of blocks1) {
        expect(blocks2.includes(block)).to.be.true(`Block ${block.cid} not found in the second car`)
      }
    }
  }

  if (options?.skip?.includes(CarEqualsSkip.version) !== true) {
    expect(car1.version).to.deep.equal(car2.version)
  }
}
