import { ApiError } from "./errors";

export async function readJson(request: Request, maximum = 65536): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "CONTENT_TYPE", "Expected application/json.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > maximum) {
          await reader.cancel();
          throw new ApiError(413, "BODY_TOO_LARGE", "Request body exceeds the allowed size.");
        }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "INVALID_JSON", "Malformed JSON request."); }
}
