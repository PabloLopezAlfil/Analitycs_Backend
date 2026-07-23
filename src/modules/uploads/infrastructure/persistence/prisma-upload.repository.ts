import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type {
  CreateUploadInput,
  UploadInterface,
  UploadSummaryInterface,
} from '../../domain/upload.interface.js';
import type { UploadRepository } from './upload.repository.js';

/**
 * Adaptador de salida: persiste el agregado (upload -> html_documents -> images)
 * en una única operación (nested create) y devuelve el agregado ya creado.
 */
export class PrismaUploadRepository implements UploadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(input: CreateUploadInput): Promise<UploadInterface> {
    const row = await this.prisma.upload.create({
      data: {
        type: input.type,
        originalName: input.originalName,
        htmlDocuments: {
          create: input.htmlDocuments.map((doc) => ({
            name: doc.name,
            content: doc.content,
            relativePath: doc.relativePath,
            images: {
              create: doc.images.map((img) => ({
                originalName: img.originalName,
                url: img.url,
                relativePath: img.relativePath,
                mimeType: img.mimeType,
                isAccesible: img.isAccesible,
              })),
            },
          })),
        },
      },
      include: { htmlDocuments: { include: { images: true } } },
    });

    return {
      id: row.id,
      type: row.type,
      originalName: row.originalName,
      createdAt: row.created_at.toISOString(),
      htmlDocuments: row.htmlDocuments.map((doc) => ({
        id: doc.id,
        name: doc.name,
        content: doc.content,
        relativePath: doc.relativePath,
        images: doc.images.map((img) => ({
          id: img.id,
          originalName: img.originalName,
          url: img.url,
          relativePath: img.relativePath,
          mimeType: img.mimeType,
          isAccesible: img.isAccesible,
        })),
      })),
    };
  }

  async findAll(): Promise<UploadSummaryInterface[]> {
    const rows = await this.prisma.upload.findMany({ orderBy: { created_at: 'desc' } });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      originalName: row.originalName,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async findById(id: number): Promise<UploadInterface | null> {
    const row = await this.prisma.upload.findUnique({
      where: { id },
      include: { htmlDocuments: { include: { images: true } } },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      type: row.type,
      originalName: row.originalName,
      createdAt: row.created_at.toISOString(),
      htmlDocuments: row.htmlDocuments.map((doc) => ({
        id: doc.id,
        name: doc.name,
        content: doc.content,
        relativePath: doc.relativePath,
        images: doc.images.map((img) => ({
          id: img.id,
          originalName: img.originalName,
          url: img.url,
          relativePath: img.relativePath,
          mimeType: img.mimeType,
          isAccesible: img.isAccesible,
        })),
      })),
    };
  }

  async delete(id: number): Promise<void> {
    await this.prisma.upload.delete({ where: { id } });
  }
}
