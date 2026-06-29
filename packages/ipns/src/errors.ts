import type { IPNSRecord } from './records.ts'

export class RecordsFailedValidationError extends Error {
  static name = 'RecordsFailedValidationError'
  name = 'RecordsFailedValidationError'
}

export class UnsupportedMultibasePrefixError extends Error {
  static name = 'UnsupportedMultibasePrefixError'
  name = 'UnsupportedMultibasePrefixError'
}

export class UnsupportedMultihashCodecError extends Error {
  static name = 'UnsupportedMultihashCodecError'
  name = 'UnsupportedMultihashCodecError'
}

export class InvalidValueError extends Error {
  static name = 'InvalidValueError'
  name = 'InvalidValueError'
}

export class InvalidTopicError extends Error {
  static name = 'InvalidTopicError'
  name = 'InvalidTopicError'
}

export class RecordNotFoundError extends Error {
  static name = 'RecordNotFoundError'
  name = 'RecordNotFoundError'
}

export class RecordAlreadyPublishedError extends Error {
  static name = 'RecordAlreadyPublishedError'
  name = 'RecordAlreadyPublishedError'
  record: IPNSRecord

  constructor (message: string, record: IPNSRecord) {
    super(message)

    this.record = record
  }
}

export class SignatureCreationError extends Error {
  static name = 'SignatureCreationError'
  name = 'SignatureCreationError'
}

export class SignatureVerificationError extends Error {
  static name = 'SignatureVerificationError'
  name = 'SignatureVerificationError'
}

export class RecordExpiredError extends Error {
  static name = 'RecordExpiredError'
  name = 'RecordExpiredError'
}

export class UnsupportedValidityError extends Error {
  static name = 'UnsupportedValidityError'
  name = 'UnsupportedValidityError'
}

export class RecordTooLargeError extends Error {
  static name = 'RecordTooLargeError'
  name = 'RecordTooLargeError'
}

export class InvalidRecordDataError extends Error {
  static name = 'InvalidRecordDataError'
  name = 'InvalidRecordDataError'
}

export class InvalidEmbeddedPublicKeyError extends Error {
  static name = 'InvalidEmbeddedPublicKeyError'
  name = 'InvalidEmbeddedPublicKeyError'
}
