export abstract class UnixFSError extends Error {
  public readonly name: string
  public readonly code: string

  constructor (message: string, name: string, code: string) {
    super(message)

    this.name = name
    this.code = code
  }
}

export class NotUnixFSError extends UnixFSError {
  constructor (message = 'not a Unixfs node') {
    super(message, 'NotUnixFSError', 'ERR_NOT_UNIXFS')
  }
}

export class InvalidPBNodeError extends UnixFSError {
  constructor (message = 'invalid PBNode') {
    super(message, 'InvalidPBNodeError', 'ERR_INVALID_PB_NODE')
  }
}

export class UnknownError extends UnixFSError {
  constructor (message = 'unknown error') {
    super(message, 'InvalidPBNodeError', 'ERR_UNKNOWN_ERROR')
  }
}

export class AlreadyExistsError extends UnixFSError {
  constructor (message = 'path already exists') {
    super(message, 'AlreadyExistsError', 'ERR_ALREADY_EXISTS')
  }
}

export class DoesNotExistError extends UnixFSError {
  constructor (message = 'path does not exist') {
    super(message, 'DoesNotExistError', 'ERR_DOES_NOT_EXIST')
  }
}

export class NoContentError extends UnixFSError {
  constructor (message = 'no content') {
    super(message, 'NoContentError', 'ERR_NO_CONTENT')
  }
}

export class NotAFileError extends UnixFSError {
  constructor (message = 'not a file') {
    super(message, 'NotAFileError', 'ERR_NOT_A_FILE')
  }
}

export class NotADirectoryError extends UnixFSError {
  constructor (message = 'not a directory') {
    super(message, 'NotADirectoryError', 'ERR_NOT_A_DIRECTORY')
  }
}

export class InvalidParametersError extends UnixFSError {
  constructor (message = 'invalid parameters') {
    super(message, 'InvalidParametersError', 'ERR_INVALID_PARAMETERS')
  }
}
