import { randomUUID } from 'node:crypto';
import type { UploadRepository } from '../infrastructure/persistence/upload.repository.js';
import type { ImageValidator } from '../infrastructure/validation/image.validator.js';
import type { ImageStorage } from '../infrastructure/storage/image.storage.js';
import type { HtmlDocumentInput, ImageInput, UploadInterface } from './upload.interface.js';
import type {
  ParsedEmail,
  ParsedImageRef,
  UploadedFileInput,
  UploadParser,
} from './parsers/parsed-upload.js';
import { basename, isHttpUrl, mimeFromExtension } from './parsers/html-helpers.js';
import { ValidationError } from './errors.js';

const HTML_EXTENSIONS = ['html', 'htm'];

/**
 * Caso de uso: procesar un archivo subido y persistirlo.
 *
 * Orquesta el flujo común: selecciona el parser por formato, resuelve el I/O de
 * las imágenes (validar las públicas / guardar en disco las locales) y persiste
 * el agregado. El parseo específico de cada formato vive en los parsers.
 */
export class CreateUploadUseCase {
  constructor(
    private readonly repository: UploadRepository,
    private readonly imageValidator: ImageValidator,
    private readonly imageStorage: ImageStorage,
    private readonly htmlParser: UploadParser,
    private readonly zipParser: UploadParser,
  ) {}

  async execute(file: UploadedFileInput): Promise<UploadInterface> {
    const parser = this.selectParser(file.originalName);
    const parsed = parser.parse(file);

    const uploadFolder = randomUUID();
    const htmlDocuments = await Promise.all(
      parsed.emails.map((email) => this.resolveEmail(email, uploadFolder)),
    );

    return this.repository.save({
      type: parsed.type,
      originalName: file.originalName,
      htmlDocuments,
    });
  }

  private selectParser(originalName: string): UploadParser {
    const extension = originalName.split('.').pop()?.toLowerCase() ?? '';
    if (HTML_EXTENSIONS.includes(extension)) {
      return this.htmlParser;
    }
    if (extension === 'zip') {
      return this.zipParser;
    }
    throw new ValidationError('Tipo de archivo no soportado. Solo se admiten .html, .htm o .zip');
  }

  private async resolveEmail(email: ParsedEmail, uploadFolder: string): Promise<HtmlDocumentInput> {
    const images = await Promise.all(
      email.images.map((ref) => this.resolveImage(ref, uploadFolder)),
    );
    return {
      name: email.name,
      content: email.content,
      relativePath: email.relativePath,
      images,
    };
  }

  private async resolveImage(ref: ParsedImageRef, uploadFolder: string): Promise<ImageInput> {
    // Imagen pública: se valida por red.
    if (isHttpUrl(ref.src)) {
      const { accessible, contentType } = await this.imageValidator.validate(ref.src);
      return {
        originalName: basename(ref.src),
        url: ref.src,
        relativePath: null,
        mimeType: contentType,
        isAccesible: accessible,
      };
    }

    // Imagen local incluida en el archivo: se guarda en disco.
    if (ref.local) {
      const url = await this.imageStorage.save(uploadFolder, ref.local.storageKey, ref.local.content);
      return {
        originalName: basename(ref.src),
        url,
        relativePath: ref.src,
        mimeType: mimeFromExtension(ref.src),
        isAccesible: true,
      };
    }

    // Ruta relativa sin fichero asociado (HTML individual, o referencia rota en el ZIP).
    return {
      originalName: basename(ref.src),
      url: ref.src,
      relativePath: ref.src,
      mimeType: null,
      isAccesible: false,
    };
  }
}
