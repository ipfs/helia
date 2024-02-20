/**
 * Takes a filename URL param and returns a string for use in a
 * `Content-Disposition` header
 */
export function getContentDispositionFilename (filename: string): string {
  const asciiOnly = replaceNonAsciiCharacters(filename)

  if (asciiOnly === filename) {
    return `filename="${filename}"`
  }

  return `filename="${asciiOnly}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

function replaceNonAsciiCharacters (filename: string): string {
  // eslint-disable-next-line no-control-regex
  return filename.replace(/[^\x00-\x7F]/g, '_')
}
