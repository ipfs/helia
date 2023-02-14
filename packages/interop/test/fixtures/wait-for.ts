
export interface WaitForOptions {
  timeout: number
  delay?: number
  message?: string
}

export async function waitFor (fn: () => Promise<boolean>, options: WaitForOptions): Promise<void> {
  const delay = options.delay ?? 100
  const timeoutAt = Date.now() + options.timeout

  while (true) {
    const result = await fn()

    if (result) {
      return
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => { resolve() }, delay)
    })

    if (Date.now() > timeoutAt) {
      throw new Error(options.message ?? 'WaitFor timed out')
    }
  }
}
