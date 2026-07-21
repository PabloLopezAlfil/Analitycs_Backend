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
 * Ruido que macOS inyecta al comprimir (Archive Utility / `zip`): la carpeta
 * `__MACOSX` con los "resource forks" AppleDouble (`._archivo`) y los `.DS_Store`.
 * No son contenido real del ZIP; si se colaran, un `._index.html` se tomaría
 * como un HTML más y aparecería como un documento fantasma.
 */
function isMacOsJunk(path: string): boolean {
  const segments = path.split('/');
  if (segments.includes('__MACOSX')) return true;
  const name = segments[segments.length - 1] ?? '';
  return name === '.DS_Store' || name.startsWith('._');
}

/**
 * Adaptador de salida: lee un ZIP con `adm-zip` y devuelve sus ficheros
 * (omite las entradas de directorio y el ruido de macOS).
 */
export class AdmZipArchiveReader implements ArchiveReader {
  read(buffer: Buffer): ArchiveEntry[] {
    const zip = new AdmZip(buffer);
    return zip
      .getEntries()
      .filter((entry) => !entry.isDirectory && !isMacOsJunk(entry.entryName))
      .map((entry) => ({ path: entry.entryName, content: entry.getData() }));
  }
}
