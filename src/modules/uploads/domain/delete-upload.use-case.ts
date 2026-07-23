import type { UploadRepository } from '../infrastructure/persistence/upload.repository.js';
import type { ImageStorage } from '../infrastructure/storage/image.storage.js';
import { isHttpUrl } from './parsers/html-helpers.js';
import { NotFoundError } from './errors.js';

/**
 * Caso de uso: eliminar una subida en cascada (docs 0002 §6.1). Borra el
 * agregado de BD (la cascada de Prisma arrastra html_documents e images) y los
 * ficheros de las imágenes locales guardadas en disco.
 */
export class DeleteUploadUseCase {
  constructor(
    private readonly repository: UploadRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(id: number): Promise<void> {
    const upload = await this.repository.findById(id);
    if (!upload) {
      throw new NotFoundError('Subida no encontrada');
    }

    await this.repository.delete(id);

    const localImages = upload.htmlDocuments
      .flatMap((doc) => doc.images)
      .filter((image) => !isHttpUrl(image.url));
    await Promise.all(localImages.map((image) => this.imageStorage.remove(image.url)));
  }
}
