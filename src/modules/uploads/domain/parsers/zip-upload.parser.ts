import type { ArchiveEntry, ArchiveReader } from '../../infrastructure/archive/archive.reader.js';
import type {
  ParsedEmail,
  ParsedImageRef,
  ParsedUpload,
  UploadParser,
  UploadedFileInput,
} from './parsed-upload.js';
import {
  basename,
  extractImageSources,
  isHtmlPath,
  isHttpUrl,
  posixDirname,
  posixJoin,
  topFolder,
} from './html-helpers.js';
import { ValidationError } from '../errors.js';

/**
 * Parser de ZIP. Agrupa los HTML por carpeta de primer nivel (cada carpeta = un
 * email) y, para cada uno, localiza su HTML principal y asocia sus imágenes
 * locales con las entradas del ZIP. Una carpeta -> ZIP_SINGLE; varias ->
 * ZIP_MULTIPLE.
 */
export class ZipUploadParser implements UploadParser {
  constructor(private readonly archiveReader: ArchiveReader) {}

  parse(file: UploadedFileInput): ParsedUpload {
    const entries = this.archiveReader.read(file.buffer);
    const htmlEntries = entries.filter((entry) => isHtmlPath(entry.path));

    if (htmlEntries.length === 0) {
      throw new ValidationError('El ZIP no contiene ningún archivo HTML');
    }

    const folders = [...new Set(htmlEntries.map((entry) => topFolder(entry.path)))];

    // Una carpeta = ZIP_SINGLE; varias carpetas = ZIP_MULTIPLE (un email por carpeta).
    const emails = folders.map((folder) => this.parseEmail(folder, htmlEntries, entries));
    const type = folders.length > 1 ? 'ZIP_MULTIPLE' : 'ZIP_SINGLE';

    return { type, emails };
  }

  private parseEmail(
    folder: string,
    htmlEntries: ArchiveEntry[],
    entries: ArchiveEntry[],
  ): ParsedEmail {
    const inFolder = htmlEntries.filter((entry) => topFolder(entry.path) === folder);
    const mainHtml =
      inFolder.find((entry) => basename(entry.path).toLowerCase() === 'index.html') ?? inFolder[0];
    if (!mainHtml) {
      throw new ValidationError('No se encontró el HTML principal del ZIP');
    }

    const content = mainHtml.content.toString('utf8');
    const htmlDir = posixDirname(mainHtml.path);

    const images: ParsedImageRef[] = extractImageSources(content).map((rawSrc) => {
      const src = rawSrc.replace(/^\.\//, '');
      if (isHttpUrl(src)) {
        return { src };
      }
      const fullPath = posixJoin(htmlDir, src);
      const entry = entries.find((candidate) => candidate.path === fullPath);
      return entry ? { src, local: { storageKey: fullPath, content: entry.content } } : { src };
    });

    return { name: basename(mainHtml.path), relativePath: folder || null, content, images };
  }
}
