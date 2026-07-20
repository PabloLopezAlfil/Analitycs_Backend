import { readFile } from 'node:fs/promises';

/**
 * Convierte un fichero local (p. ej. una imagen guardada en `storage/uploads`)
 * en una data URL, para enviarla como entrada mínima a un flow (docs/0005 §2)
 * sin exponer rutas del servidor.
 */
export async function fileToDataUrl(path: string, mimeType: string): Promise<string> {
  const content = await readFile(path);
  return `data:${mimeType};base64,${content.toString('base64')}`;
}
