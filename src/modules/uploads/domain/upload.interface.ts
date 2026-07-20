// --- Agregado que se devuelve hacia el exterior ---

export interface ImageInterface {
  id: number;
  originalName: string;
  url: string;
  relativePath: string | null;
  mimeType: string | null;
  isAccesible: boolean;
}

export interface HtmlDocumentInterface {
  id: number;
  name: string;
  content: string;
  relativePath: string | null;
  images: ImageInterface[];
}

export interface UploadInterface {
  id: number;
  type: string;
  originalName: string;
  createdAt: string;
  htmlDocuments: HtmlDocumentInterface[];
}

/** Resumen de una subida para el listado (sin las relaciones anidadas). */
export interface UploadSummaryInterface {
  id: number;
  type: string;
  originalName: string;
  createdAt: string;
}

// --- Datos de entrada para crear una subida (sin ids ni fechas) ---

export interface ImageInput {
  originalName: string;
  url: string;
  relativePath: string | null;
  mimeType: string | null;
  isAccesible: boolean;
}

export interface HtmlDocumentInput {
  name: string;
  content: string;
  relativePath: string | null;
  images: ImageInput[];
}

export interface CreateUploadInput {
  type: string;
  originalName: string;
  htmlDocuments: HtmlDocumentInput[];
}
