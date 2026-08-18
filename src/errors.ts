export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso não autorizado.') {
    super(message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticação necessária.') {
    super(message, 401);
  }
}
