import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Puerto de almacenamiento de imágenes locales (las extraídas de un ZIP).
 * Devuelve la ubicación donde quedó guardada la imagen.
 */
export interface ImageStorage {
  save(uploadFolder: string, relativePath: string, content: Buffer): Promise<string>;
}

/**
 * Adaptador de salida: guarda los binarios en disco, bajo `<baseDir>/<uploadFolder>/…`.
 * El `url` devuelto es la ruta del fichero en disco (ver documentación 0002).
 */
export class LocalImageStorage implements ImageStorage {
  constructor(private readonly baseDir: string) {}

  async save(uploadFolder: string, relativePath: string, content: Buffer): Promise<string> {
    const destination = join(this.baseDir, uploadFolder, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
    return destination;
  }
}
