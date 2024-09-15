export class InsufficientProvidersError extends Error {
  static name = 'InsufficientProvidersError'

  constructor (message = 'Insufficient providers found') {
    super(message)
    this.name = 'InsufficientProvidersError'
  }
}

export class NoRoutersAvailableError extends Error {
  static name = 'NoRoutersAvailableError'

  constructor (message = 'No routers available') {
    super(message)
    this.name = 'NoRoutersAvailableError'
  }
}
