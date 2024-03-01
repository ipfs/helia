import { decode, encodingLength } from 'uint8-varint'

function varintDecoder (buf: Uint8Array): number[] {
  if (!(buf instanceof Uint8Array)) {
    throw new Error('arg needs to be a Uint8Array')
  }

  const result: number[] = []

  while (buf.length > 0) {
    const num = decode(buf)
    result.push(num)
    buf = buf.slice(encodingLength(num))
  }

  return result
}

export default varintDecoder
