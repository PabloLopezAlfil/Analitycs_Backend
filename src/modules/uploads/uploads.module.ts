import type { Router } from 'express';
import { getPrisma } from '../../db/prisma.js';
import { PrismaUploadRepository } from './infrastructure/persistence/prisma-upload.repository.js';
import { FetchImageValidator } from './infrastructure/validation/image.validator.js';
import { LocalImageStorage } from './infrastructure/storage/image.storage.js';
import { AdmZipArchiveReader } from './infrastructure/archive/archive.reader.js';
import { HtmlUploadParser } from './domain/parsers/html-upload.parser.js';
import { ZipUploadParser } from './domain/parsers/zip-upload.parser.js';
import { CreateUploadUseCase } from './domain/create-upload.use-case.js';
import { ListUploadsUseCase } from './domain/list-uploads.use-case.js';
import { GetUploadUseCase } from './domain/get-upload.use-case.js';
import { UploadsRouter } from './infrastructure/transport/uploads.router.js';

// Carpeta base donde se guardan las imágenes locales extraídas de los ZIP.
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? 'storage/uploads';

/**
 * Composition root del módulo de subidas: instancia los adaptadores concretos y
 * los parsers, los inyecta en el caso de uso y devuelve el router listo.
 */
export function buildUploadsRouter(): Router {
  const repository = new PrismaUploadRepository(getPrisma());
  const imageValidator = new FetchImageValidator();
  const imageStorage = new LocalImageStorage(UPLOADS_DIR);
  const htmlParser = new HtmlUploadParser();
  const zipParser = new ZipUploadParser(new AdmZipArchiveReader());

  const createUpload = new CreateUploadUseCase(
    repository,
    imageValidator,
    imageStorage,
    htmlParser,
    zipParser,
  );
  const listUploads = new ListUploadsUseCase(repository);
  const getUpload = new GetUploadUseCase(repository);

  return UploadsRouter({ createUpload, listUploads, getUpload });
}
