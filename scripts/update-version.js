import heliaPkg from '../packages/helia/package.json' assert { type: 'json'}
import rootPkg from '../package.json' assert { type: 'json'}
import { writeFile } from 'fs/promises'

rootPkg.version = heliaPkg.version
await writeFile(new URL('../package.json', import.meta.url), `${JSON.stringify(rootPkg, null, 2)}\n`)
