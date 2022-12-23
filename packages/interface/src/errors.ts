export abstract class HeliaError extends Error {
  public readonly name: string
  public readonly code: string

  constructor (message: string, name: string, code: string) {
    super(message)

    this.name = name
    this.code = code
  }
}

export class NotAFileError extends HeliaError {
  constructor (message = 'not a file') {
    super(message, 'NotAFileError', 'ERR_NOT_FILE')
  }
}

export class NoContentError extends HeliaError {
  constructor (message = 'no content') {
    super(message, 'NoContentError', 'ERR_NO_CONTENT')
  }
}

export class InvalidParametersError extends HeliaError {
  constructor (message = 'invalid parameters') {
    super(message, 'InvalidParametersError', 'ERR_INVALID_PARAMETERS')
  }
}
