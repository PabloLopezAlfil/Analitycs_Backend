export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = 'Credenciales inválidas') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
