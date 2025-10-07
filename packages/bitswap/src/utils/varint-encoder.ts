import { encode, encodingLength } from 'uint8-varint'

function varintEncoder (buf: number[]): Uint8Array {
  let out: Uint8Array = new Uint8Array(buf.reduce((acc, curr) => {
    return acc + encodingLength(curr)
  }, 0))
  let offset = 0

  for (const num of buf) {
    out = encode(num, out, offset)

    offset += encodingLength(num)
  }

  return out
}

export default varintEncoder
