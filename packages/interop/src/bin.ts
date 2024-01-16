#! /usr/bin/env node
/* eslint-disable no-console */

import { spawn } from 'node:child_process'

const test = spawn('npx', ['aegir', 'test'])

test.stdout.on('data', (data) => {
  process.stdout.write(data)
})

test.stderr.on('data', (data) => {
  process.stderr.write(data)
})

test.on('close', (code) => {
  process.exit(code ?? 0)
})
