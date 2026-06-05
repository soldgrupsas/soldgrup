// Utilidad compartida para comprimir/redimensionar imágenes antes de subirlas.
// Reduce el tamaño de las fotos (que en celulares modernos pueden pesar varios MB)
// para que la subida funcione en dispositivos de gama baja y redes lentas.

export interface CompressImageOptions {
  /** Lado máximo (ancho o alto) en píxeles. Por defecto 1600. */
  maxDimension?: number;
  /** Calidad JPEG entre 0 y 1. Por defecto 0.8. */
  quality?: number;
}

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.8;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    img.src = objectUrl;
  });

/**
 * Comprime y redimensiona una imagen a JPEG. Si algo falla (formato no soportado,
 * navegador sin canvas, etc.) devuelve el archivo original para no bloquear la subida.
 */
export const compressImage = async (
  file: File,
  options: CompressImageOptions = {},
): Promise<File> => {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  // Solo procesamos imágenes; cualquier otro tipo se devuelve intacto.
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const image = await loadImage(file);

    const scale = Math.min(
      maxDimension / image.width,
      maxDimension / image.height,
      1,
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (!blob) {
      return file;
    }

    // Si por alguna razón el resultado quedó más grande que el original, conservamos el original.
    if (blob.size >= file.size && scale === 1) {
      return file;
    }

    const baseName = file.name.includes(".")
      ? file.name.slice(0, file.name.lastIndexOf("."))
      : file.name;

    return new File([blob], `${baseName || "foto"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("No se pudo comprimir la imagen, se usará el archivo original.", error);
    return file;
  }
};
