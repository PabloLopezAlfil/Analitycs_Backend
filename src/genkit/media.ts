import { readFile } from 'node:fs/promises';
import { resolve as resolvePath, sep } from 'node:path';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Raíz de almacenamiento de imágenes locales (mismo default que el módulo de subidas). */
function storageRoot(): string {
  return resolvePath(process.env.UPLOADS_DIR ?? 'storage/uploads');
}

/**
 * Verifica que una ruta local queda contenida dentro del directorio de
 * almacenamiento, para evitar path traversal (p. ej. `../../etc/passwd` en el
 * `src` de un <img> subido) al leer el fichero de disco.
 */
function assertWithinStorage(path: string): void {
  const root = storageRoot();
  const resolved = resolvePath(path);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Ruta local fuera del almacenamiento permitido: ${path}`);
  }
}

/**
 * Convierte un fichero local (p. ej. una imagen guardada en `storage/uploads`)
 * en una data URL, para enviarla como entrada mínima a un flow (docs/0005 §2)
 * sin exponer rutas del servidor.
 */
export async function fileToDataUrl(path: string, mimeType: string): Promise<string> {
  const content = await readFile(path);
  return `data:${mimeType};base64,${content.toString('base64')}`;
}

/**
 * Prepara una imagen para enviarla a un flow de IA como "entrada mínima"
 * (docs/0005 §2), según su origen:
 *
 * - **data URL** → se devuelve tal cual.
 * - **URL pública http(s)** → se devuelve tal cual. La descarga el proveedor de
 *   IA (OpenAI/xAI), NO nuestro backend: así el servidor nunca hace peticiones a
 *   URLs controladas por el usuario (evita SSRF desde el servidor).
 * - **ruta local** → se lee de disco y se embebe en base64, tras comprobar que
 *   queda contenida en el directorio de almacenamiento (evita path traversal).
 *
 * Nota: el proveedor activo debe saber descargar URLs públicas (OpenAI/xAI sí;
 * Ollama exigiría base64). Ver docs/0005 §7.
 */
export async function imageToModelInput(
  pathOrUrl: string,
  mimeType: string | null,
): Promise<string> {
  if (pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  if (isHttpUrl(pathOrUrl)) {
    return pathOrUrl;
  }
  assertWithinStorage(pathOrUrl);
  return fileToDataUrl(pathOrUrl, mimeType ?? 'image/png');
}
