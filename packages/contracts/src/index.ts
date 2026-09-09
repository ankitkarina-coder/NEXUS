export type ApiError = { error: { code: string; message: string } };
export type HealthResponse = { status: "ok"; service: "nexus-api" };