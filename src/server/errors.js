import "server-only";

/**
 * Errors that services throw on purpose. Their message is safe to show to the user.
 * Any other error is treated as unexpected: logged on the server, shown as a generic message.
 */
export class AppError extends Error {
  constructor(message, { code = "APP_ERROR", status = 400, fieldErrors } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please correct the highlighted fields.", fieldErrors) {
    super(message, { code: "VALIDATION", status: 400, fieldErrors });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Please sign in.") {
    super(message, { code: "UNAUTHENTICATED", status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this.") {
    super(message, { code: "FORBIDDEN", status: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Record not found.") {
    super(message, { code: "NOT_FOUND", status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message, fieldErrors) {
    super(message, { code: "CONFLICT", status: 409, fieldErrors });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please wait a few minutes and try again.") {
    super(message, { code: "RATE_LIMITED", status: 429 });
  }
}

/** Turn a Zod error into `{ field: "first message" }`. */
export function zodFieldErrors(zodError) {
  const out = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parse with a Zod schema or throw a ValidationError. */
export function parseOrThrow(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(undefined, zodFieldErrors(result.error));
  return result.data;
}
