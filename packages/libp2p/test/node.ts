import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect } from 'aegir/chai'

const execFileAsync = promisify(execFile)
const fixture = fileURLToPath(new URL('./fixtures/import-without-webrtc.ts', import.meta.url))

/**
 * Import `specifier` in a child process that refuses to load WebRTC, resolve
 * with stdout on success or reject with the child's error on failure
 */
async function importWithoutWebRTC (specifier: string): Promise<string> {
  const { stdout } = await execFileAsync(process.execPath, [fixture, specifier], {
    cwd: fileURLToPath(new URL('../', import.meta.url))
  })

  return stdout
}

describe('@helia/libp2p/light', () => {
  it('should not load WebRTC', async () => {
    const stdout = await importWithoutWebRTC('@helia/libp2p/light')

    expect(stdout).to.include('imported @helia/libp2p/light')
  })

  it('should detect WebRTC being loaded by the main entry point', async () => {
    // control - proves the resolve hook used by the fixture actually fires
    await expect(importWithoutWebRTC('@helia/libp2p')).to.eventually.be.rejected
      .with.property('stderr').that.include('forbidden import of @libp2p/webrtc')
  })
})
