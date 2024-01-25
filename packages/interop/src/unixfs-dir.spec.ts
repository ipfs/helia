/* eslint-env mocha */

import { trustlessGateway } from '@helia/block-brokers'
import { createHeliaHTTP } from '@helia/http'
import { type UnixFS, unixfs } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { createKuboNode } from './fixtures/create-kubo.js'
import { loadFixtureDataCar } from './fixtures/load-fixture-data.js'
import type { Helia } from '@helia/interface'
import type { Controller } from 'ipfsd-ctl'

describe('@helia/unixfs - dir', () => {
  let helia: Helia
  let unixFs: UnixFS
  let kubo: Controller
  before(async () => {
    kubo = await createKuboNode()
    helia = await createHeliaHTTP({
      blockBrokers: [
        trustlessGateway({
          gateways: [`http://${kubo.api.gatewayHost}:${kubo.api.gatewayPort}`]
        })
      ]
    })
    unixFs = unixfs(helia)
    await kubo.start()
  })

  after(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  describe('HAMT-sharded', () => {
    const cid = CID.parse('bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i')
    before(async () => {
      // from https://github.com/ipfs/gateway-conformance/blob/193833b91f2e9b17daf45c84afaeeae61d9d7c7e/fixtures/trustless_gateway_car/single-layer-hamt-with-multi-block-files.car
      await loadFixtureDataCar(kubo, 'bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i-single-layer-hamt-with-multi-block-files.car')
    })

    it('.stat - recognizes a hamt-sharded directory', async () => {
      const stat = await unixFs.stat(cid)
      expect(stat.type).to.equal('directory')
      expect(stat.unixfs?.type).to.equal('hamt-sharded-directory')
    })

    it('.cat - subpath parsing works properly', async function () {
      let data: string = ''
      const textDecoder = new TextDecoder()
      const unixFsCatIter = unixFs.cat(cid, {
        path: '/685.txt'
      })
      for await (const chunk of unixFsCatIter) {
        data += textDecoder.decode(chunk)
      }
      // npx kubo@0.25.0 cat '/ipfs/bafybeidbclfqleg2uojchspzd4bob56dqetqjsj27gy2cq3klkkgxtpn4i/685.txt'
      expect(data).to.equal(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc non imperdiet nunc. Proin ac quam ut nibh eleifend aliquet. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed ligula dolor, imperdiet sagittis arcu et, semper tincidunt urna. Donec et tempor augue, quis sollicitudin metus. Curabitur semper ullamcorper aliquet. Mauris hendrerit sodales lectus eget fermentum. Proin sollicitudin vestibulum commodo. Vivamus nec lectus eu augue aliquet dignissim nec condimentum justo. In hac habitasse platea dictumst. Mauris vel sem neque.

Vivamus finibus, enim at lacinia semper, arcu erat gravida lacus, sit amet gravida magna orci sit amet est. Sed non leo lacus. Nullam viverra ipsum a tincidunt dapibus. Nulla pulvinar ligula sit amet ante ultrices tempus. Proin purus urna, semper sed lobortis quis, gravida vitae ipsum. Aliquam mi urna, pulvinar eu bibendum quis, convallis ac dolor. In gravida justo sed risus ullamcorper, vitae luctus massa hendrerit. Pellentesque habitant amet.`)
    })
  })
})
