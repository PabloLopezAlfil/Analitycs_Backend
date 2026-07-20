import type { Router } from 'express';
import { getPrisma } from '../../db/prisma.js';
import { PrismaImageRepository } from './infrastructure/persistence/prisma-image.repository.js';
import { ListImagesUseCase } from './domain/list-images.use-case.js';
import { GetImageUseCase } from './domain/get-image.use-case.js';
import { ImagesRouter } from './infrastructure/transport/images.router.js';

/**
 * Composition root del módulo de imágenes.
 */
export function buildImagesRouter(): Router {
  const repository = new PrismaImageRepository(getPrisma());
  const listImages = new ListImagesUseCase(repository);
  const getImage = new GetImageUseCase(repository);

  return ImagesRouter({ listImages, getImage });
}
