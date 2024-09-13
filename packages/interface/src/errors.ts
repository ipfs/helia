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

export class UnknownHashAlgorithmError extends Error {
  static name = 'UnknownHashAlgorithmError'

  constructor (message = 'Unknown hash algorithm') {
    super(message)
    this.name = 'UnknownHashAlgorithmError'
  }
}

export class UnknownCodecError extends Error {
  static name = 'UnknownCodecError'

  constructor (message = 'Unknown codec') {
    super(message)
    this.name = 'UnknownCodecError'
  }
}
