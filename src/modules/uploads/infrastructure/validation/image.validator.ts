export interface ImageValidationResult {
  accessible: boolean;
  contentType: string | null;
}

/**
 * Puerto de validación de imágenes públicas.
 */
export interface ImageValidator {
  validate(url: string): Promise<ImageValidationResult>;
}

/**
 * Adaptador de salida: valida la accesibilidad de una imagen pública con
 * `fetch` (petición HEAD). Si la URL no responde o es inválida, la considera
 * no accesible.
 */
export class FetchImageValidator implements ImageValidator {
  async validate(url: string): Promise<ImageValidationResult> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return {
        accessible: response.ok,
        contentType: response.headers.get('content-type'),
      };
    } catch {
      return { accessible: false, contentType: null };
    }
  }
}
