import type { Command } from './index.js'
import { createHelia } from '../utils/create-helia.js'
import { createHeliaGrpcServer } from '@helia/rpc-server'
import { EdKeypair } from '@ucans/ucans'

interface DaemonArgs {
  positionals?: string[]
}

export const daemon: Command<DaemonArgs> = {
  description: 'Starts a Helia daemon',
  example: '$ helia daemon',
  async execute ({ config, stdout }) {
    const helia = await createHelia(config)

    const serverKey = EdKeypair.fromSecretKey(config.grpc.serverKey, {
      format: 'base64url'
    })

    await createHeliaGrpcServer({
      helia,
      ownerDID: '',
      serviceDID: serverKey.did()
    })

    const id = await helia.id()

    stdout.write(`${id.agentVersion} is running\n`)

    id.multiaddrs.forEach(ma => {
      stdout.write(`${ma.toString()}\n`)
    })
  }
}
