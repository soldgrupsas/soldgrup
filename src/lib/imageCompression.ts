// Utilidad compartida para comprimir/redimensionar imágenes antes de subirlas.
// Reduce el tamaño de las fotos (que en celulares modernos pueden pesar varios MB)
// para que la subida funcione en dispositivos de gama baja y redes lentas.
//
// Además convierte fotos HEIC/HEIF (formato por defecto de los iPhone) a JPEG.
// El servidor (Edge Function process-maintenance-photo) no puede decodificar HEIC,
// por lo que estas fotos deben transformarse en el navegador antes de enviarse.

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

const getBaseName = (name: string): string => {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  return base || "foto";
};

// Detecta HEIC/HEIF tanto por MIME type como por extensión, ya que algunos
// navegadores reportan el tipo vacío para estos archivos.
const isHeicFile = (file: File): boolean => {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
};

// Convierte un archivo HEIC/HEIF a JPEG usando heic2any (carga diferida para no
// engrosar el bundle principal). Si la conversión falla devuelve el archivo original;
// algunos navegadores (Safari de iPhone) sí pueden decodificar HEIC en el canvas.
const convertHeicToJpeg = async (file: File): Promise<File> => {
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], `${getBaseName(file.name)}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("No se pudo convertir la imagen HEIC, se intentará con el archivo original.", error);
    return file;
  }
};

/**
 * Comprime y redimensiona una imagen a JPEG. Convierte HEIC/HEIF a JPEG primero.
 * Si algo falla (formato no soportado, navegador sin canvas, etc.) devuelve el
 * mejor archivo disponible para no bloquear la subida.
 */
export const compressImage = async (
  file: File,
  options: CompressImageOptions = {},
): Promise<File> => {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const heic = isHeicFile(file);

  // Solo procesamos imágenes; cualquier otro tipo se devuelve intacto.
  // (Los HEIC a veces llegan sin MIME type, por eso se evalúan aparte.)
  if (!heic && !file.type.startsWith("image/")) {
    return file;
  }

  // Los HEIC deben convertirse sí o sí: el servidor no los puede procesar.
  let workingFile = file;
  if (heic) {
    workingFile = await convertHeicToJpeg(file);
  }

  try {
    const image = await loadImage(workingFile);

    const scale = Math.min(
      maxDimension / image.width,
      maxDimension / image.height,
      1,
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return workingFile;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (!blob) {
      return workingFile;
    }

    // Si por alguna razón el resultado quedó más grande que el original (y no se
    // redimensionó ni convirtió), conservamos el archivo de trabajo.
    if (!heic && blob.size >= workingFile.size && scale === 1) {
      return workingFile;
    }

    return new File([blob], `${getBaseName(workingFile.name)}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("No se pudo comprimir la imagen, se usará el archivo disponible.", error);
    return workingFile;
  }
};
