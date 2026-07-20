export interface ImageInterface {
  id: number;
  htmlId: number;
  originalName: string;
  url: string;
  relativePath: string | null;
  mimeType: string | null;
  isAccesible: boolean;
  createdAt: string;
}
