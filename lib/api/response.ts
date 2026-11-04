import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export async function apiHandler<T>(
  operation: () => Promise<{ data: T; meta?: Record<string, unknown> }>,
): Promise<Response> {
  const requestId = randomUUID();
  const headers = {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    "X-Content-Type-Options": "nosniff",
  };

  try {
    return Response.json({ ...(await operation()), requestId }, { headers });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request parameters.",
            details: error.issues.map(({ path, message }) => ({ path, message })),
          },
          requestId,
        },
        { status: 400, headers },
      );
    }

    if (error instanceof ApiError) {
      if (error.status >= 500) {
        console.error("API service unavailable", { requestId, code: error.code });
      }
      return Response.json(
        { error: { code: error.code, message: error.message }, requestId },
        { status: error.status, headers },
      );
    }

    // Do not log database URLs, query arguments, or personal data.
    console.error("Unhandled API error", {
      requestId,
      type: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." }, requestId },
      { status: 500, headers },
    );
  }
}
