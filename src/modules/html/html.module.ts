import type { Router } from 'express';
import { getPrisma } from '../../db/prisma.js';
import { PrismaHtmlDocumentRepository } from './infrastructure/persistence/prisma-html-document.repository.js';
import { ListHtmlDocumentsUseCase } from './domain/list-html-documents.use-case.js';
import { GetHtmlDocumentUseCase } from './domain/get-html-document.use-case.js';
import { HtmlRouter } from './infrastructure/transport/html.router.js';

/**
 * Composition root del módulo de documentos HTML: instancia los adaptadores y
 * los inyecta en el caso de uso, devolviendo el router listo para montar.
 */
export function buildHtmlRouter(): Router {
  const repository = new PrismaHtmlDocumentRepository(getPrisma());
  const listHtmlDocuments = new ListHtmlDocumentsUseCase(repository);
  const getHtmlDocument = new GetHtmlDocumentUseCase(repository);

  return HtmlRouter({ listHtmlDocuments, getHtmlDocument });
}
