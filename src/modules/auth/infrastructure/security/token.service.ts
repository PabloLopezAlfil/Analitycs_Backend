import jwt, { type JwtPayload } from 'jsonwebtoken';

export interface TokenPayload {
  sub: number;
  email: string;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload | null;
}

/**
 * Emite y verifica JWT firmados con HS256 usando jsonwebtoken.
 * `verify` lo necesitarán las rutas protegidas (logout, etc.).
 */
export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresInSeconds: number,
  ) {}

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresInSeconds });
  }

  verify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as JwtPayload;
      return { sub: Number(decoded.sub), email: String(decoded.email) };
    } catch {
      // Firma inválida, token mal formado o caducado.
      return null;
    }
  }
}
