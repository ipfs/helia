import hashlru from 'hashlru'

/**
 * Time Aware Least Recent Used Cache
 *
 * @see https://arxiv.org/pdf/1801.00390
 */
export class TLRU<T> {
  private readonly lru: ReturnType<typeof hashlru>

  constructor (maxSize: number) {
    this.lru = hashlru(maxSize)
  }

  get (key: string): T | undefined {
    const value = this.lru.get(key)

    if (value != null) {
      if (value.expire != null && value.expire < Date.now()) {
        this.lru.remove(key)

        return undefined
      }

      return value.value
    }

    return undefined
  }

  set (key: string, value: T, ttl: number): void {
    this.lru.set(key, { value, expire: Date.now() + ttl })
  }

  has (key: string): boolean {
    const value = this.get(key)

    if (value != null) {
      return true
    }

    return false
  }

  remove (key: string): void {
    this.lru.remove(key)
  }

  clear (): void {
    this.lru.clear()
  }
}
