function isPrimitive (value: any): boolean {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'function' ||
    typeof value === 'bigint'
}

export function merge <T> (target: T, ...sources: T[]): T {
  const output = target as any

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

  return target
}

export function replace <T> (target: T, ...sources: T[]): T {
  const output = target as any

  for (const source of sources) {
    Object.entries(source as any).forEach(([key, value]) => {
      if (Array.isArray(value) || Array.isArray(output[key])) {
        output[key] = value
        return
      }

      if (isPrimitive(value) || output[key] == null) {
        output[key] = value
        return
      }

      replace(output[key], value)
    })
  }

  return target
}
