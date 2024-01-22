export async function getFixtureDataStream (filename: string): Promise<ReadableStream<Uint8Array>> {
  const fixtureDataResp = await fetch(`${process.env.FIXTURE_DATA_SERVER}/${filename}`)

  if (!fixtureDataResp.ok) throw new Error(`Failed to fetch ${filename}: ${fixtureDataResp.statusText}`)
  if (fixtureDataResp.body == null) throw new Error(`Failed to fetch ${filename}: no body`)

  return fixtureDataResp.body
}

export async function * getFixtureDataAsyncIterable (filename: string): AsyncIterable<Uint8Array> {
  const fixtureDataResp = await fetch(`${process.env.FIXTURE_DATA_SERVER}/${filename}`, { method: 'GET' })

  if (!fixtureDataResp.ok) throw new Error(`Failed to fetch ${filename}: ${fixtureDataResp.statusText}`)
  if (fixtureDataResp.body == null) throw new Error(`Failed to fetch ${filename}: no body`)

  const reader = fixtureDataResp.body.getReader()
  let data = await reader.read()
  while (!data.done) {
    yield data.value
    data = await reader.read()
  }
  if (data.value != null) yield data.value
}
