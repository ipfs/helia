import getPort from 'aegir/get-port'
import { createServer } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'

// TODO: disable online fetching for kubo node
// TODO: Disable delegated routing in browser only until waterworks CORS bug is fixed - https://github.com/ipshipyard/waterworks-community/issues/4
/** @type {import('aegir').PartialOptions} */
export default {
}
