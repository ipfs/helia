import nodePath from 'node:path'

import { Bench } from 'tinybench'
import type { CID } from 'multiformats/cid'
import { createHeliaBenchmark } from './helia.js'
import { createIpfsBenchmark } from './ipfs.js'
import { createKuboBenchmark } from './kubo.js'
import { createKuboDirectBenchmark } from './kubo-direct.js'
import debug from 'debug'

const log = debug('bench:add-dir')
const ITERATIONS = parseInt(process.env.ITERATIONS ?? '5')
const MIN_TIME = parseInt(process.env.MIN_TIME ?? '1')
const TEST_PATH = process.env.TEST_PATH
const RESULT_PRECISION = 2

export interface AddDirBenchmark {
  teardown: () => Promise<void>
  addFile?: (path: string) => Promise<CID>
  addDir: (path: string) => Promise<CID>
}

interface BenchmarkTaskResult {
  timing: number[]
  cids: Map<string, Set<string>>
}

const impls: Array<{ name: string, create: () => Promise<AddDirBenchmark>, results: BenchmarkTaskResult }> = [
  {
    name: 'helia-fs',
    create: () => createHeliaBenchmark(),
    results: {
      timing: [],
      cids: new Map<string, Set<string>>(),
    }
  },
  {
    name: 'helia-mem',
    create: () => createHeliaBenchmark({ blockstoreType: 'mem', datastoreType: 'mem' }),
    results: {
      timing: [],
      cids: new Map<string, Set<string>>(),
    }
  },
  {
    name: 'ipfs',
    create: () => createIpfsBenchmark(),
    results: {
      timing: [],
      cids: new Map<string, Set<string>>(),
    }
  },
  {
    name: 'kubo',
    create: () => createKuboBenchmark(),
    results: {
      timing: [],
      cids: new Map<string, Set<string>>(),
    }
  },
  {
    name: 'kubo-direct',
    create: () => createKuboDirectBenchmark(),
    results: {
      timing: [],
      cids: new Map<string, Set<string>>(),
    }
  }
]

async function main(): Promise<void> {
  let subject: AddDirBenchmark

  const suite = new Bench({
    iterations: ITERATIONS,
    time: MIN_TIME,
    setup: async (task) => {
      log(`Start: setup`)
      const impl = impls.find(({ name }) => task.name.includes(name))
      if (impl) {
        subject = await impl.create()
      } else {
        throw new Error(`No implementation with name '${task.name}'`)
      }
      log(`End: setup`)
    },
    teardown: async () => {
      log(`Start: teardown`)
      await subject.teardown()
      log(`End: teardown`)
    }
  })

  const testPaths = TEST_PATH ?
    [TEST_PATH] :
    [
      nodePath.relative(process.cwd(), nodePath.join(process.cwd(), 'src')),
      nodePath.relative(process.cwd(), nodePath.join(process.cwd(), 'dist')),
      nodePath.relative(process.cwd(), nodePath.join(process.cwd(), '..', 'gc', 'src')),
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
          },
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
        `${(impl.results.timing.reduce((acc, curr) => acc + curr, 0) / impl.results.timing.length).toFixed(RESULT_PRECISION)},`,
      )
    }
  } else {
    const implCids: Record<string, string> = {}
    for (const impl of impls) {
      for (const [testPath, cids] of impl.results.cids.entries()) {
        implCids[`${impl.name} - ${testPath}`] = Array.from(cids).join(', ')
      }
    }
    console.table(suite.tasks.map(({ name, result }) => {
      if (result?.error != null) {
        return {
          'Implementation': name,
          'ops/s': 'error',
          'ms/op': 'error',
          'runs': 'error',
          'stddev': 'error',
          'CID': (result?.error as any)?.message,
        }
      }
      return {
        'Implementation': name,
        'ops/s': result?.hz.toFixed(RESULT_PRECISION),
        'ms/op': result?.period.toFixed(RESULT_PRECISION),
        'runs': result?.samples.length,
        'p99': result?.p99.toFixed(RESULT_PRECISION),
        'CID': implCids[name]
      }
    }))
  }
  process.exit(0) // sometimes the test hangs (need to debug)
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
