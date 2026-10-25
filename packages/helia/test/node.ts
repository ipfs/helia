import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect } from 'aegir/chai'

const execFileAsync = promisify(execFile)
const fixture = fileURLToPath(new URL('./fixtures/import-without-libp2p.ts', import.meta.url))

/**
 * Import `specifier` in a child process that refuses to load libp2p, resolve
 * with stdout on success or reject with the child's error on failure
 */
async function importWithoutLibp2p (specifier: string): Promise<string> {
  const { stdout } = await execFileAsync(process.execPath, [fixture, specifier], {
    cwd: fileURLToPath(new URL('../', import.meta.url))
  })

  return stdout
}

describe('helia/light', () => {
  it('should not load libp2p', async () => {
    const stdout = await importWithoutLibp2p('helia/light')

    expect(stdout).to.include('imported helia/light')
  })

  it('should detect libp2p being loaded by the main entry point', async () => {
    // control - proves the resolve hook used by the fixture actually fires
    await expect(importWithoutLibp2p('helia')).to.eventually.be.rejected
      .with.property('stderr').that.include('forbidden import of @helia/')
  })
})
