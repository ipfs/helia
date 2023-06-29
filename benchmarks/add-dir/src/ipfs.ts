import { create } from 'ipfs-core'
import type { AddDirBenchmark } from './index.js'
import os from 'node:os'
import path from 'node:path'
import fs, { promises as fsPromises } from 'node:fs'
import nodePath from 'node:path'
import { sha256 } from 'multiformats/hashes/sha2'

import * as dagPb from '@ipld/dag-pb'
import { UnixFS } from 'ipfs-unixfs'
import { CID } from 'multiformats/cid'
import all from 'it-all'

export async function createIpfsBenchmark (): Promise<AddDirBenchmark> {
  const repoPath = path.join(os.tmpdir(), `ipfs-${Math.random()}`)

  const ipfs = await create({
    config: {
      Addresses: {
        Swarm: []
      }
    },
    repo: repoPath,
    start: false,
    init: {
      emptyRepo: true
    }
  })

  const addFile = async (path: string) => (await ipfs.add({ path: nodePath.relative(process.cwd(), path), content: fs.createReadStream(path)}, { cidVersion: 1, pin: false })).cid

  const addDir = async function (dir: string): Promise<CID> {
    const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
    const links: dagPb.PBLink[] = [];

    for (const dirent of dirents) {
      const path = nodePath.join(dir, dirent.name);

      if (dirent.isDirectory()) {
        const cid = await addDir(path);

        links.push({
          Hash: cid,
          Name: dirent.name
        });
      } else {
        const cid = await addFile(path);
        links.push({ Name: dirent.name, Hash: cid });
      }
    }

    const metadata = new UnixFS({
      type: 'directory'
    });

    const buf = dagPb.encode({
      Data: metadata.marshal(),
      Links: links
    });

    const hash = await sha256.digest(buf);
    const cid = CID.create(1, dagPb.code, hash);

    return cid;
  };

  const getFolderSize = async (cid: CID) => {
    const files = await all(ipfs.ls(cid))
    let size = BigInt(0)
    for (const file of files) {
      if (file.type === 'dir') {
        size += await getFolderSize(file.cid)
      } else {
        size += BigInt(file.size)
      }
    }
    return size
  }

  return {
    async teardown () {
      await ipfs.stop()
      await fsPromises.rm(repoPath, { recursive: true, force: true })
    },
    addFile,
    addDir,
    // TODO: fix error `Error: ENOENT: no such file or directory, open '/var/folders/bl/_gl5_59s11v7qz5ysd6bfgb00000gn/T/ipfs-0.5718863035297312/blocks/HT/CIQDL3WAXRMDRTJMORI6Z64ZT22DVW2PCP34LIO67DL4UTZIFU4AHTA.data'`
    // getSize: getFolderSize
  }
}
