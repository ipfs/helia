import type { AddDirBenchmark } from './index.js'
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import * as goRpcClient from 'kubo-rpc-client'
import fs, { promises as fsPromises } from 'node:fs'
import nodePath from 'node:path'
import { sha256 } from 'multiformats/hashes/sha2'

import { createController } from 'ipfsd-ctl'
import * as dagPb from '@ipld/dag-pb'
import { UnixFS } from 'ipfs-unixfs'
import { CID } from 'multiformats/cid'
import all from 'it-all'


export async function createKuboBenchmark (): Promise<AddDirBenchmark> {
  const controller = await createController({
    type: 'go',
    test: true,
    ipfsBin: goIpfs.path(),
    kuboRpcModule: goRpcClient,
    ipfsOptions: {
      init: {
        emptyRepo: true
      }
    }
  })

  const addFile = async (path: string) => (await controller.api.add({ path: nodePath.relative(process.cwd(), path), content: fs.createReadStream(path)}, { cidVersion: 1, pin: false })).cid

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
    const files = await all(controller.api.ls(cid))
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
      const { repoPath } = await controller.api.repo.stat()
      await controller.stop()
      await fsPromises.rm(repoPath, { recursive: true, force: true })
    },
    addFile,
    addDir,
    // TODO: Fix timing out during size calculation.
    // getSize: getFolderSize
  }
}
