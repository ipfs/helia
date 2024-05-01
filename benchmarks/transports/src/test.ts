/* eslint-disable no-console */

import debug from 'debug'
import { execa, type ExecaChildProcess } from 'execa'
import type { File } from './index.js'
import type { Test as TestInit } from './tests.js'

const outLog = debug('test:stdout')
const errorLog = debug('test:stderr')

const TEST_OUTPUT_PREFIX = 'TEST-OUTPUT:'

export class Test {
  public name: string
  private senderProc?: ExecaChildProcess<string>
  private recipientProc?: ExecaChildProcess<string>
  private readonly test: TestInit

  constructor (init: TestInit) {
    this.name = init.name
    this.test = init
  }

  async runTest (file: File): Promise<string> {
    this.senderProc = this.startSender(file)

    const { cid, multiaddrs } = await new Promise<{ cid: string, multiaddrs: string }>((resolve, reject) => {
      this.senderProc?.stderr?.on('data', (buf) => {
        errorLog('error', buf.toString())
      })

      this.senderProc?.stdout?.on('data', (buf) => {
        outLog('info', buf.toString())

        let output = buf.toString()

        if (output.startsWith(TEST_OUTPUT_PREFIX) === false) {
          return
        }

        output = output.trim().replace(TEST_OUTPUT_PREFIX, '')

        resolve(JSON.parse(output))
      })
    })

    this.recipientProc = this.startRecipient(cid, multiaddrs)

    let result: string = ''

    await new Promise<void>((resolve, reject) => {
      this.recipientProc?.stderr?.on('data', (buf) => {
        errorLog('error', buf.toString())
      })

      this.recipientProc?.stdout?.on('data', (buf) => {
        outLog('info', buf.toString())

        const output: string = buf.toString()

        output
          .split('\n')
          .map(str => str.trim())
          .filter(str => str.startsWith(TEST_OUTPUT_PREFIX))
          .forEach((str) => {
            str = str.replace(TEST_OUTPUT_PREFIX, '')

            if (str === 'done') {
              resolve()
            } else {
              result = str
            }
          })
      })
    })

    this.recipientProc.kill()
    this.senderProc.kill()

    // wait for processes to exit
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!isRunning(this.recipientProc?.pid) && !isRunning(this.senderProc?.pid)) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
    })

    return result
  }

  startSender (file: File): ExecaChildProcess<string> {
    return execa(this.test.senderExec ?? 'node', [...(this.test.senderArgs ?? []), `./dist/src/runner/${this.test.senderImplementation}/sender.js`], {
      env: {
        HELIA_TYPE: 'sender',
        HELIA_IMPORT_OPTIONS: JSON.stringify(file.options),
        HELIA_FILE_SIZE: `${file.size}`,
        HELIA_LISTEN: this.test.senderListen
      }
    })
  }

  startRecipient (cid: string, multiaddrs: string): ExecaChildProcess<string> {
    return execa(this.test.recipientExec ?? 'node', [...(this.test.recipientArgs ?? []), `./dist/src/runner/${this.test.recipientImplementation}/recipient.js`], {
      env: {
        HELIA_TYPE: 'recipient',
        HELIA_CID: cid,
        HELIA_MULTIADDRS: multiaddrs,
        HELIA_TIMEOUT: `${60000 * 5}` // 5 minute timeout
      }
    })
  }
}

function isRunning (pid: number = 0): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return false
  }
}
