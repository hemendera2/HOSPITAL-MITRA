export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'unauthorized', message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'forbidden', message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'not_found', message);
  }
  static conflict(message: string) {
    return new ApiError(409, 'conflict', message);
  }
  static unprocessable(message: string, details?: unknown) {
    return new ApiError(422, 'unprocessable_entity', message, details);
  }
}

/** Domain error for invalid/duplicate QR identifiers, reserved for export. */
export class QrError extends Error {
  constructor(public code: 'duplicate' | 'invalid' | 'unverified', message: string) {
    super(message);
    this.name = 'QrError';
  }
}
