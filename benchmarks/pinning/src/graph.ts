import { execa } from 'execa'

const ITERATIONS = 2
const INCREMENT = 1000
const MAX = 10000

for (let i = 1; i <= MAX / INCREMENT; i++) {
  await execa('node', ['dist/src/index.js'], {
    env: {
      ...process.env,
      INCREMENT: (i * INCREMENT).toString(),
      ITERATIONS: ITERATIONS.toString(),
      ITERATION: i.toString()
    },
    stdout: 'inherit',
    stderr: 'inherit'
  })
}
