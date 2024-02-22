export function okResponse (body?: BodyInit | null): Response {
  return new Response(body, {
    status: 200,
    statusText: 'OK'
  })
}

export function notSupportedResponse (body?: BodyInit | null): Response {
  const response = new Response(body, {
    status: 501,
    statusText: 'Not Implemented'
  })
  response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
  return response
}

export function notAcceptableResponse (body?: BodyInit | null): Response {
  return new Response(body, {
    status: 406,
    statusText: 'Not Acceptable'
  })
}
