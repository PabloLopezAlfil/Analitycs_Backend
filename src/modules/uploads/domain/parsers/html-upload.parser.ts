import type { ParsedUpload, UploadParser, UploadedFileInput } from './parsed-upload.js';
import { extractImageSources } from './html-helpers.js';

/**
 * Parser de HTML individual: un único email cuyo contenido es el propio archivo.
 * Sus imágenes son referencias del HTML (normalmente URLs públicas); no hay
 * ficheros locales asociados.
 */
export class HtmlUploadParser implements UploadParser {
  parse(file: UploadedFileInput): ParsedUpload {
    const content = file.buffer.toString('utf8');
    const images = extractImageSources(content).map((src) => ({ src }));

    return {
      type: 'HTML',
      emails: [{ name: file.originalName, relativePath: null, content, images }],
    };
  }
}
