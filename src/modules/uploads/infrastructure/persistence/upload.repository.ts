import type {
  CreateUploadInput,
  UploadInterface,
  UploadSummaryInterface,
} from '../../domain/upload.interface.js';

/**
 * Puerto de persistencia de subidas. La infraestructura provee la
 * implementación concreta (Prisma/MySQL).
 */
export interface UploadRepository {
  save(input: CreateUploadInput): Promise<UploadInterface>;
  findAll(): Promise<UploadSummaryInterface[]>;
  findById(id: number): Promise<UploadInterface | null>;
}
