import { ApiError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/response";
import { businessCommandSchema } from "@/lib/validations/demo-business";
import { executeBusinessCommand } from "@/services/demo/business";
import { demoStateResponse, guardDemoRequest } from "@/services/demo/session";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  try {
    guardDemoRequest(request);
    if (query) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not supported.");
  } catch (error) { return apiHandler(async () => { throw error; }); }
  return demoStateResponse(request);
}
export async function POST(request: Request) {
  try { guardDemoRequest(request); }
  catch (error) { return apiHandler(async () => { throw error; }); }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return apiHandler(async () => { throw new ApiError(415, "CONTENT_TYPE", "Expected application/json."); });
  }
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > 65536) {
            await reader.cancel();
            throw new ApiError(413, "BODY_TOO_LARGE", "Demo request exceeds 64 KiB.");
          }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    return apiHandler(async () => { throw error instanceof ApiError ? error : new ApiError(400, "INVALID_JSON", "Malformed JSON request."); });
  }
  return demoStateResponse(request, (state) => executeBusinessCommand(state, businessCommandSchema.parse(input)));
}
