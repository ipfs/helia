/* eslint-disable no-console,no-loop-func */

import nodePath from 'node:path'
import debug from 'debug'
import { CID } from 'multiformats/cid'
import { Bench } from 'tinybench'
import { createHeliaBenchmark } from './helia.js'
import { createIpfsBenchmark } from './ipfs.js'
import { createKuboDirectBenchmark } from './kubo-direct.js'
import { createKuboBenchmark } from './kubo.js'

const log = debug('bench:add-dir')
const ITERATIONS = parseInt(process.env.ITERATIONS ?? '5')
const MIN_TIME = parseInt(process.env.MIN_TIME ?? '1')
const TEST_PATH = process.env.TEST_PATH
const RESULT_PRECISION = 2

export interface AddDirBenchmark {
  teardown: () => Promise<void>
  addFile?: (path: string) => Promise<CID>
  addDir: (path: string) => Promise<CID>
  getSize?: (cid: CID) => Promise<bigint>
}

interface BenchmarkTaskResult {
  timing: number[]
  cids: Map<string, Set<string>>
  sizes: Map<string, Set<string>>
}

const getDefaultResults = (): BenchmarkTaskResult => ({
  timing: [],
  cids: new Map<string, Set<string>>(),
  sizes: new Map<string, Set<string>>()
})

const impls: Array<{ name: string, create: () => Promise<AddDirBenchmark>, results: BenchmarkTaskResult }> = [
  {
    name: 'helia-fs',
    create: async () => createHeliaBenchmark(),
    results: getDefaultResults()
  },
  {
    name: 'helia-mem',
    create: async () => createHeliaBenchmark({ blockstoreType: 'mem', datastoreType: 'mem' }),
    results: getDefaultResults()
  },
  {
    name: 'ipfs',
    create: async () => createIpfsBenchmark(),
    results: getDefaultResults()
  },
  {
    name: 'kubo',
    create: async () => createKuboBenchmark(),
    results: getDefaultResults()
  },
  {
    name: 'kubo-direct',
    create: async () => createKuboDirectBenchmark(),
    results: getDefaultResults()
  }
]

async function main (): Promise<void> {
  let subject: AddDirBenchmark

  const suite = new Bench({
    iterations: ITERATIONS,
    time: MIN_TIME,
    setup: async (task) => {
      log('Start: setup')
      const impl = impls.find(({ name }) => task.name.includes(name))
      if (impl != null) {
        subject = await impl.create()
      } else {
        throw new Error(`No implementation with name '${task.name}'`)
      }
      log('End: setup')
    },
    teardown: async () => {
      log('Start: teardown')
      await subject.teardown()
      log('End: teardown')
    }
  })

  const testPaths = TEST_PATH != null
    ? [TEST_PATH]
    : [
        nodePath.relative(process.cwd(), nodePath.join(process.cwd(), 'src')),
        nodePath.relative(process.cwd(), nodePath.join(process.cwd(), 'dist')),
        nodePath.relative(process.cwd(), nodePath.join(process.cwd(), '..', 'gc', 'src'))
      ]

  for (const impl of impls) {
    for (const testPath of testPaths) {
      const absPath = nodePath.join(process.cwd(), testPath)
      suite.add(`${impl.name} - ${testPath}`, async function () {
        const start = Date.now()
        const cid = await subject.addDir(absPath)
        impl.results.timing.push(Date.now() - start)
        const cidSet = impl.results.cids.get(testPath) ?? new Set()
        cidSet.add(cid.toString())
        impl.results.cids.set(testPath, cidSet)
      },
      {
        beforeEach: async () => {
          log(`Start: test ${impl.name}`)
        },
        afterEach: async () => {
          log(`End: test ${impl.name}`)
          const cidSet = impl.results.cids.get(testPath)
          if (cidSet != null) {
            for (const cid of cidSet.values()) {
              const size = await subject.getSize?.(CID.parse(cid))
              if (size != null) {
                const statsSet = impl.results.sizes.get(testPath) ?? new Set()
                statsSet.add(size?.toString())
                impl.results.sizes.set(testPath, statsSet)
              }
            }
          }
        }
      }
      )
    }
  }

  await suite.run()

  if (process.env.INCREMENT != null) {
    if (process.env.ITERATION === '1') {
      console.info('implementation, count, add dir (ms), cid')
    }

    for (const impl of impls) {
      console.info(
        `${impl.name},`,
        `${process.env.INCREMENT},`,
        `${(impl.results.timing.reduce((acc, curr) => acc + curr, 0) / impl.results.timing.length).toFixed(RESULT_PRECISION)},`
      )
    }
  } else {
    const implCids: Record<string, string> = {}
    const implSizes: Record<string, string> = {}
    for (const impl of impls) {
      for (const [testPath, cids] of impl.results.cids.entries()) {
        implCids[`${impl.name} - ${testPath}`] = Array.from(cids).join(', ')
      }
      for (const [testPath, sizes] of impl.results.sizes.entries()) {
        implSizes[`${impl.name} - ${testPath}`] = Array.from(sizes).join(', ')
      }
    }
    console.table(suite.tasks.map(({ name, result }) => {
      if (result?.error != null) {
        return {
          Implementation: name,
          'ops/s': 'error',
          'ms/op': 'error',
          runs: 'error',
          p99: 'error',
          CID: (result?.error as any)?.message
        }
      }
      return {
        Implementation: name,
        'ops/s': result?.hz.toFixed(RESULT_PRECISION),
        'ms/op': result?.period.toFixed(RESULT_PRECISION),
        runs: result?.samples.length,
        p99: result?.p99.toFixed(RESULT_PRECISION),
        CID: implCids[name]
      }
    }))
  }
  process.exit(0) // sometimes the test hangs (need to debug)
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
