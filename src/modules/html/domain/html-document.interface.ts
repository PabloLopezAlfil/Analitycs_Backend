/** Resumen de un documento HTML para el listado (sin `content` ni `images`). */
export interface HtmlDocumentSummaryInterface {
  id: number;
  uploadId: number;
  name: string;
  relativePath: string | null;
  createdAt: string;
}

export interface HtmlImageInterface {
  id: number;
  originalName: string;
  url: string;
  relativePath: string | null;
  mimeType: string | null;
  isAccesible: boolean;
}

/** Detalle de un documento HTML: sus campos + content + sus imágenes asociadas. */
export interface HtmlDocumentDetailInterface {
  id: number;
  uploadId: number;
  name: string;
  content: string;
  relativePath: string | null;
  createdAt: string;
  images: HtmlImageInterface[];
}
