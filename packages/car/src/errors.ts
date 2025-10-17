export class NotUnixFSError extends Error {
  static code = 'ERR_NOT_UNIXFS'
  static message = 'Not a UnixFS node'
  static name = 'NotUnixFSError'
  code = 'ERR_NOT_UNIXFS'
  message = 'Not a UnixFS node'
  name = 'NotUnixFSError'
}

export class NotDescendantError extends Error {
  static name = 'NotDescendantError'
  name = 'NotDescendantError'
}

export class InvalidTraversalError extends Error {
  static name = 'InvalidTraversalError'
  name = 'InvalidTraversalError'
}
