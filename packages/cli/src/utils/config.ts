import type { ParseArgsConfig } from 'node:util'

export function config (options: any): ParseArgsConfig {
  return {
    allowPositionals: true,
    strict: true,
    options: {
      help: {
        description: 'Show help text',
        type: 'boolean'
      },
      ...options
    }
  }
}
