export interface ApiError {
  error: { code: string; message: string };
}

export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}
