export class BlockTooLargeError extends Error {
  static name = 'BlockTooLargeError'

  constructor (message = 'Block too large') {
    super(message)
    this.name = 'BlockTooLargeError'
  }
}
