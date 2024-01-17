// currently getting error from esbuild when trying to import file-type
// import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types'

interface testInput {
  bytes: Uint8Array
  path: string
}

type testOutput = Promise<string | undefined>

export const DEFAULT_MIME_TYPE = 'text/html'

const xmlRegex = /^(<\?xml[^>]+>)?[^<^\w]+<svg/ig

/**
 * Tests to determine the content type of the input.
 * The order is important on this one.
 */
const tests: Array<(input: testInput) => testOutput> = [
  // svg
  async ({ bytes }): testOutput => xmlRegex.test(new TextDecoder().decode(bytes.slice(0, 64)))
    ? 'image/svg+xml'
    : undefined,
  // testing file-type from buffer
  // async ({ bytes }): testOutput => (await fileTypeFromBuffer(bytes))?.mime,
  // testing file-type from path
  async ({ path }): testOutput => mime.lookup(path) || undefined,
  // default
  async (): Promise<string> => DEFAULT_MIME_TYPE
]

const overrides: Record<string, string> = {
  'video/quicktime': 'video/mp4'
}

/**
 * Override the content type based on overrides.
 */
function overrideContentType (type: string): string {
  return overrides[type] ?? type
}

/**
 * Get the content type from the input based on the tests.
 */
export async function getContentType (input: testInput): Promise<string> {
  for (const test of tests) {
    const type = await test(input)
    if (type !== undefined) {
      return overrideContentType(type)
    }
  }
  return DEFAULT_MIME_TYPE
}
