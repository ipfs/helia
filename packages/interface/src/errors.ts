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

export class InvalidCodecError extends Error {
  static name = 'InvalidCodecError'

  constructor (message = 'Invalid codec') {
    super(message)
    this.name = 'InvalidCodecError'
  }
}

export class UnknownCryptoError extends Error {
  static name = 'UnknownCryptoError'
  name = 'UnknownCryptoError'
}

/**
 * Normally when retrieving a block from a session peer fails, that peer is
 * evicted from the session.
 *
 * This error is thrown when the retrieval failed for a reason not related to
 * that peer, so they should remain in the session.
 */
export class NoEvictionError extends Error {
  static name = 'NoEvictionError'
  name = 'NoEvictionError'
}
