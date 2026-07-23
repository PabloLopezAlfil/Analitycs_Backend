import { Router } from 'express';
import { formidable } from 'formidable';
import { readFile } from 'node:fs/promises';
import { CreateUploadUseCase } from '../../domain/create-upload.use-case.js';
import { ListUploadsUseCase } from '../../domain/list-uploads.use-case.js';
import { GetUploadUseCase } from '../../domain/get-upload.use-case.js';
import { DeleteUploadUseCase } from '../../domain/delete-upload.use-case.js';
import { NotFoundError, ValidationError } from '../../domain/errors.js';

interface UploadsRouterDeps {
  createUpload: CreateUploadUseCase;
  listUploads: ListUploadsUseCase;
  getUpload: GetUploadUseCase;
  deleteUpload: DeleteUploadUseCase;
}

/**
 * Adaptador de entrada (HTTP/Express). Parsea el multipart/form-data (campo
 * `file`), delega en el caso de uso y traduce sus errores a códigos HTTP.
 */
export function UploadsRouter({ createUpload, listUploads, getUpload, deleteUpload }: UploadsRouterDeps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const uploads = await listUploads.execute();
      res.status(200).json(uploads);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      // Id no numérico: se trata como no encontrado, sin consultar la BD.
      if (!Number.isInteger(id)) {
        throw new NotFoundError('Subida no encontrada');
      }
      const upload = await getUpload.execute(id);
      res.status(200).json(upload);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      // Id no numérico: se trata como no encontrado, sin consultar la BD.
      if (!Number.isInteger(id)) {
        throw new NotFoundError('Subida no encontrada');
      }
      await deleteUpload.execute(id);
      res.status(204).end();
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const form = formidable({});
      const [, files] = await form.parse(req);

      const uploaded = files.file?.[0];
      if (!uploaded) {
        throw new ValidationError('Debe adjuntarse un archivo en el campo "file"');
      }

      const buffer = await readFile(uploaded.filepath);
      const upload = await createUpload.execute({
        originalName: uploaded.originalFilename ?? uploaded.newFilename,
        buffer,
      });

      res.status(201).json(upload);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}
