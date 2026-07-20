import AdmZip from 'adm-zip';

export interface ArchiveEntry {
  /** Ruta completa dentro del archivo, p. ej. `email/images/banner.jpg`. */
  path: string;
  content: Buffer;
}

/**
 * Puerto de lectura de archivos comprimidos.
 */
export interface ArchiveReader {
  read(buffer: Buffer): ArchiveEntry[];
}

/**
 * Adaptador de salida: lee un ZIP con `adm-zip` y devuelve sus ficheros
 * (omite las entradas de directorio).
 */
export class AdmZipArchiveReader implements ArchiveReader {
  read(buffer: Buffer): ArchiveEntry[] {
    const zip = new AdmZip(buffer);
    return zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => ({ path: entry.entryName, content: entry.getData() }));
  }
}
