export class DNSLinkNotFoundError extends Error {
  static name = 'DNSLinkNotFoundError'

  constructor (message = 'DNSLink not found') {
    super(message)
    this.name = 'DNSLinkNotFoundError'
  }
}

export class InvalidNamespaceError extends Error {
  static name = 'InvalidNamespaceError'

  constructor (message = 'Invalid namespace') {
    super(message)
    this.name = 'InvalidNamespaceError'
  }
}
