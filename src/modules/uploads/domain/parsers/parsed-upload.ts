export interface UploadedFileInput {
  originalName: string;
  buffer: Buffer;
}

/** Referencia a una imagen encontrada en el HTML de un email. */
export interface ParsedImageRef {
  /** `src` tal como aparece en el HTML. */
  src: string;
  /** Presente solo si es un fichero local incluido en el archivo (ZIP). */
  local?: {
    /** Clave única de almacenamiento (ruta completa dentro del archivo). */
    storageKey: string;
    content: Buffer;
  };
}

/** Un email ya extraído del archivo (aún sin resolver el I/O de sus imágenes). */
export interface ParsedEmail {
  name: string;
  relativePath: string | null;
  content: string;
  images: ParsedImageRef[];
}

/** Resultado de parsear un archivo subido, con el tipo ya determinado. */
export interface ParsedUpload {
  type: string;
  emails: ParsedEmail[];
}

/**
 * Puerto de parseo por formato: convierte los bytes del archivo en la estructura
 * normalizada. No hace I/O de red ni de disco (eso lo resuelve el caso de uso).
 */
export interface UploadParser {
  parse(file: UploadedFileInput): ParsedUpload;
}
