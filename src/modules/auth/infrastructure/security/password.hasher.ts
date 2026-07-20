import bcrypt from 'bcrypt';

export interface PasswordHasher {
  compare(plain: string, hash: string): Promise<boolean>;
}

/**
 * Verificación de contraseñas con bcrypt. bcrypt almacena la sal dentro del
 * propio hash, por lo que compare() no necesita configuración adicional.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
