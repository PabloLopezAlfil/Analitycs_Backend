import { Router } from 'express';
import { ListImagesUseCase } from '../../domain/list-images.use-case.js';
import { GetImageUseCase } from '../../domain/get-image.use-case.js';
import { NotFoundError } from '../../domain/errors.js';

interface ImagesRouterDeps {
  listImages: ListImagesUseCase;
  getImage: GetImageUseCase;
}

/**
 * Adaptador de entrada (HTTP/Express) para el recurso `/images`.
 */
export function ImagesRouter({ listImages, getImage }: ImagesRouterDeps): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      // Filtro opcional por documento: ?html_id=:id (se ignora si no es numérico).
      const htmlId = Number(req.query.html_id);
      const filter = Number.isInteger(htmlId) ? { htmlId } : undefined;

      const images = await listImages.execute(filter);
      res.status(200).json(images);
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      // Id no numérico: se trata como no encontrado, sin consultar la BD.
      if (!Number.isInteger(id)) {
        throw new NotFoundError('Imagen no encontrada');
      }
      const image = await getImage.execute(id);
      res.status(200).json(image);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return router;
}
