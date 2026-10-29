export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.isApiError = true;
  }
  static badRequest(m, errors) { return new ApiError(400, m, errors); }
  static unauthorized(m = 'Authentication required', code) { return new ApiError(401, m, code ? { code } : undefined); }
  static forbidden(m = 'You do not have permission to do this') { return new ApiError(403, m); }
  static notFound(m = 'Not found') { return new ApiError(404, m); }
  static conflict(m, errors) { return new ApiError(409, m, errors); }
}
