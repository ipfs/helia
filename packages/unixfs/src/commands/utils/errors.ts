import { HeliaError } from '@helia/interface/errors'

export class NotUnixFSError extends HeliaError {
  constructor (message = 'not a Unixfs node') {
    super(message, 'NotUnixFSError', 'ERR_NOT_UNIXFS')
  }
}

export class InvalidPBNodeError extends HeliaError {
  constructor (message = 'invalid PBNode') {
    super(message, 'InvalidPBNodeError', 'ERR_INVALID_PBNODE')
  }
}

export class UnknownError extends HeliaError {
  constructor (message = 'unknown error') {
    super(message, 'InvalidPBNodeError', 'ERR_UNKNOWN_ERROR')
  }
}

export class AlreadyExistsError extends HeliaError {
  constructor (message = 'path already exists') {
    super(message, 'NotUnixFSError', 'ERR_ALREADY_EXISTS')
  }
}

export class DoesNotExistError extends HeliaError {
  constructor (message = 'path does not exist') {
    super(message, 'NotUnixFSError', 'ERR_DOES_NOT_EXIST')
  }
}
