// ===== Custom Error Classes =====

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// 400 Bad Request — input validation fail
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, "Bad Request", message);
  }
}

// 403 Forbidden — ไม่มีสิทธิ์
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, "Forbidden", message);
  }
}

// 404 Not Found — ไม่พบ resource
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, "Not Found", message);
  }
}

// 409 Conflict — เช่น duplicate key
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "Conflict", message);
  }
}
