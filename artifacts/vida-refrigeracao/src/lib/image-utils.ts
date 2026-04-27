const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

export type MediaItem = string;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao ler o arquivo."));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Erro de leitura."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível decodificar a imagem."));
    img.src = src;
  });
}

async function compressImageDataUrl(originalDataUrl: string): Promise<string> {
  try {
    const img = await loadImage(originalDataUrl);
    let { width, height } = img;
    if (!width || !height) return originalDataUrl;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    ctx.drawImage(img, 0, 0, width, height);
    try {
      return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    } catch {
      return originalDataUrl;
    }
  } catch {
    // Browser couldn't decode (e.g. HEIC on non-Safari) — return original bytes
    return originalDataUrl;
  }
}

function isVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith("video/")) return true;
  const name = file.name.toLowerCase();
  return /\.(mp4|mov|m4v|webm|avi|mkv|3gp|3g2)$/.test(name);
}

function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/.test(name);
}

export async function fileToMediaDataUrl(file: File): Promise<string> {
  if (isVideoFile(file)) {
    // Videos are passed through unchanged
    return readFileAsDataUrl(file);
  }
  if (!isImageFile(file)) {
    throw new Error(`Formato não suportado: ${file.name}`);
  }
  const original = await readFileAsDataUrl(file);
  return compressImageDataUrl(original);
}

export async function filesToCompressedDataUrls(files: File[] | FileList): Promise<string[]> {
  const arr = Array.from(files);
  const results: string[] = [];
  for (const f of arr) {
    try {
      results.push(await fileToMediaDataUrl(f));
    } catch (err) {
      console.error("Falha ao processar arquivo", f.name, err);
    }
  }
  return results;
}

export function isVideoDataUrl(dataUrl: string): boolean {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:video/");
}
