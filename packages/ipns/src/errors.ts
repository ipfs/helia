export class DNSLinkNotFoundError extends Error {
  static name = 'DNSLinkNotFoundError'

  constructor (message = 'DNSLink not found') {
    super(message)
    this.name = 'DNSLinkNotFoundError'
  }
}

export class RecordsFailedValidationError extends Error {
  static name = 'RecordsFailedValidationError'

  constructor (message = 'Records failed validation') {
    super(message)
    this.name = 'RecordsFailedValidationError'
  }
}

export class UnsupportedMultibasePrefixError extends Error {
  static name = 'UnsupportedMultibasePrefixError'

  constructor (message = 'Unsupported multibase prefix') {
    super(message)
    this.name = 'UnsupportedMultibasePrefixError'
  }
}

export class UnsupportedMultihashCodecError extends Error {
  static name = 'UnsupportedMultihashCodecError'

  constructor (message = 'Unsupported multihash codec') {
    super(message)
    this.name = 'UnsupportedMultihashCodecError'
  }
}

export class InvalidValueError extends Error {
  static name = 'InvalidValueError'

  constructor (message = 'Invalid value') {
    super(message)
    this.name = 'InvalidValueError'
  }
}

export class InvalidTopicError extends Error {
  static name = 'InvalidTopicError'

  constructor (message = 'Invalid topic') {
    super(message)
    this.name = 'InvalidTopicError'
  }
}
