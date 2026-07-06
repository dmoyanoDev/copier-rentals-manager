export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 0
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Sesión no válida.') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'No tenés permisos para acceder a este recurso.') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado.') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Ocurrió un error interno.') {
    super('INTERNAL_ERROR', message, 500);
    this.name = 'InternalServerError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Error de red al intentar conectar.') {
    super('NETWORK_ERROR', message, 0);
    this.name = 'NetworkError';
  }
}

export class ParseError extends AppError {
  constructor(message: string = 'La respuesta del servidor no tiene un formato válido.') {
    super('PARSE_ERROR', message, 0);
    this.name = 'ParseError';
  }
}
