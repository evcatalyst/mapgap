export class ApiError extends Error {
  constructor(code, status, message, headers = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.headers = headers;
  }
}

export function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function errorResponse(error) {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, status: error.status, message: error.message } }, error.code, error.headers);
  }
  // Upstream exceptions can include URLs or credentials. Never return them.
  return json({ error: { code: 502, status: "UPSTREAM_UNAVAILABLE", message: "The source could not complete this request. Please retry." } }, 502);
}

export async function readJson(request, maxBytes = 16_384) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send application/json.");
  }
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "Request exceeds 16 KiB.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_ARGUMENT", "A JSON body is required.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "REQUEST_TOO_LARGE", "Request exceeds 16 KiB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400, "INVALID_ARGUMENT", "Malformed JSON body."); }
}

export function requireMethod(request, method) {
  if (request.method !== method) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", `Use ${method}.`, { Allow: method });
  }
}
