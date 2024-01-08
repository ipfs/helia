import { concat as uint8ArrayConcat } from 'uint8arrays/concat'

export function wrapHash (hashFn: (value: Uint8Array) => Promise<Uint8Array>): (value: InfiniteHash | Uint8Array) => InfiniteHash {
  function hashing (value: InfiniteHash | Uint8Array): InfiniteHash {
    if (value instanceof InfiniteHash) {
      // already a hash. return it
      return value
    } else {
      return new InfiniteHash(value, hashFn)
    }
  }

  return hashing
}

export class InfiniteHash {
  _value: Uint8Array
  _hashFn: (value: Uint8Array) => Promise<Uint8Array>
  _depth: number
  _availableBits: number
  _currentBufferIndex: number
  _buffers: ConsumableBuffer[]

  constructor (value: Uint8Array, hashFn: (value: Uint8Array) => Promise<Uint8Array>) {
    if (!(value instanceof Uint8Array)) {
      throw new Error('can only hash Uint8Arrays')
    }

    this._value = value
    this._hashFn = hashFn
    this._depth = -1
    this._availableBits = 0
    this._currentBufferIndex = 0
    this._buffers = []
  }

  async take (bits: number): Promise<number> {
    let pendingBits = bits

    while (this._availableBits < pendingBits) {
      await this._produceMoreBits()
    }

    let result = 0

    while (pendingBits > 0) {
      const hash = this._buffers[this._currentBufferIndex]
      const available = Math.min(hash.availableBits(), pendingBits)
      const took = hash.take(available)
      result = (result << available) + took
      pendingBits -= available
      this._availableBits -= available

      if (hash.availableBits() === 0) {
        this._currentBufferIndex++
      }
    }

    return result
  }

  untake (bits: number): void {
    let pendingBits = bits

    while (pendingBits > 0) {
      const hash = this._buffers[this._currentBufferIndex]
      const availableForUntake = Math.min(hash.totalBits() - hash.availableBits(), pendingBits)
      hash.untake(availableForUntake)
      pendingBits -= availableForUntake
      this._availableBits += availableForUntake

      if (this._currentBufferIndex > 0 && hash.totalBits() === hash.availableBits()) {
        this._depth--
        this._currentBufferIndex--
      }
    }
  }

  async _produceMoreBits (): Promise<void> {
    this._depth++

    const value = this._depth > 0 ? uint8ArrayConcat([this._value, Uint8Array.from([this._depth])]) : this._value
    const hashValue = await this._hashFn(value)
    const buffer = new ConsumableBuffer(hashValue)

    this._buffers.push(buffer)
    this._availableBits += buffer.availableBits()
  }
}

const START_MASKS = [
  0b11111111,
  0b11111110,
  0b11111100,
  0b11111000,
  0b11110000,
  0b11100000,
  0b11000000,
  0b10000000
]

const STOP_MASKS = [
  0b00000001,
  0b00000011,
  0b00000111,
  0b00001111,
  0b00011111,
  0b00111111,
  0b01111111,
  0b11111111
]

export class ConsumableBuffer {
  _value: Uint8Array
  _currentBytePos: number
  _currentBitPos: number

  constructor (value: Uint8Array) {
    this._value = value
    this._currentBytePos = value.length - 1
    this._currentBitPos = 7
  }

  availableBits (): number {
    return this._currentBitPos + 1 + this._currentBytePos * 8
  }

  totalBits (): number {
    return this._value.length * 8
  }

  take (bits: number): number {
    let pendingBits = bits
    let result = 0
    while (pendingBits > 0 && this._haveBits()) {
      const byte = this._value[this._currentBytePos]
      const availableBits = this._currentBitPos + 1
      const taking = Math.min(availableBits, pendingBits)
      const value = byteBitsToInt(byte, availableBits - taking, taking)
      result = (result << taking) + value

      pendingBits -= taking

      this._currentBitPos -= taking
      if (this._currentBitPos < 0) {
        this._currentBitPos = 7
        this._currentBytePos--
      }
    }

    return result
  }

  untake (bits: number): void {
    this._currentBitPos += bits
    while (this._currentBitPos > 7) {
      this._currentBitPos -= 8
      this._currentBytePos += 1
    }
  }

  _haveBits (): boolean {
    return this._currentBytePos >= 0
  }
}

function byteBitsToInt (byte: number, start: number, length: number): number {
  const mask = maskFor(start, length)
  return (byte & mask) >>> start
}

function maskFor (start: number, length: number): number {
  return START_MASKS[start] & STOP_MASKS[Math.min(length + start - 1, 7)]
}
