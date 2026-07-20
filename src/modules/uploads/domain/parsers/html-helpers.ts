export function extractImageSources(html: string): string[] {
  const regex = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
  const sources: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      sources.push(match[1]);
    }
  }
  return sources;
}

export function isHttpUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

export function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path);
}

/** Primer segmento de la ruta (carpeta de primer nivel), o '' si está en la raíz. */
export function topFolder(path: string): string {
  const idx = path.indexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

export function posixDirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

export function posixJoin(dir: string, rel: string): string {
  return dir === '' ? rel : `${dir}/${rel}`;
}

export function basename(src: string): string {
  try {
    if (isHttpUrl(src)) {
      const { pathname } = new URL(src);
      return pathname.split('/').pop() || src;
    }
  } catch {
    // URL inválida: caemos al split simple.
  }
  return src.split('/').pop() || src;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

export function mimeFromExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}
