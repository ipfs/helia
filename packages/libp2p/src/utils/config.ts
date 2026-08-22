function isPrimitive (value: any): boolean {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'function' ||
    typeof value === 'bigint'
}

export function merge <T> (...sources: T[]): T {
  const output: any = {}

  for (const source of sources) {
    Object.entries(source as any).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        output[key] ??= []
        output[key].push(...value)
        return
      }

      if (isPrimitive(value) || output[key] == null) {
        output[key] = value
        return
      }

      merge(output[key], value)
    })
  }

  return output
}

export function replace <T> (...sources: T[]): T {
  const output: any = {}

  for (const source of sources) {
    Object.entries(source as any).forEach(([key, value]) => {
      output[key] = value
    })
  }

  return output
}
