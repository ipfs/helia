/* eslint-disable no-console */

import { type ExecaChildProcess } from 'execa'
import debug from 'debug'
import type { File } from './index.js'

const outLog = debug('test:stdout')
const errorLog = debug('test:stderr')

const TEST_OUTPUT_PREFIX = 'TEST-OUTPUT:'

export interface StartSender {
  (file: File): ExecaChildProcess<string>
}

export interface StartRecipient {
  (cid: string, multiaddrs: string): ExecaChildProcess<string>
}

interface TestInit {
  name: string
  startSender: StartSender
  startRecipient: StartRecipient
}

export class Test {
  public name: string
  public startSender: StartSender
  public startRecipient: StartRecipient
  private senderProc?: ExecaChildProcess<string>
  private recipientProc?: ExecaChildProcess<string>

  constructor (init: TestInit) {
    this.name = init.name
    this.startSender = init.startSender
    this.startRecipient = init.startRecipient
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

        if (!output.startsWith(TEST_OUTPUT_PREFIX)) {
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

        let output: string = buf.toString()

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
}

function isRunning (pid: number = 0): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch(e) {
    return false
  }
}
