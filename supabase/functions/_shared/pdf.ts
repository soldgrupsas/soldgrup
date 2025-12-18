import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'npm:pdf-lib@1.17.1';

interface ProposalRecord {
  [key: string]: any;
  offer_id?: string;
  client?: string;
  presentation_date?: string | null;
  contact_person?: string | null;
  reference?: string | null;
  soldgrup_contact?: string | null;
  observations?: string | null;
  technical_specs_table?: string[][] | null;
  offer_details?: string | null;
}

interface ItemRecord {
  [key: string]: any;
  item_number?: number;
  description?: string;
  quantity?: number;
  unit_price?: number | string;
  total_price?: number | string;
  unit?: string | null;
}

interface EquipmentRecord {
  [key: string]: any;
  equipment_name?: string;
  equipment_specs?: {
    description?: string;
    images?: Array<
      | string
      | {
          image_url: string;
          caption?: string | null;
        }
    >;
    tables?: { title: string; table_data: string[][] }[];
  };
}

interface ImageRecord {
  image_url: string;
  image_caption?: string | null;
}

interface CreateProposalPDFParams {
  proposal: ProposalRecord;
  items: ItemRecord[];
  equipment: EquipmentRecord[];
  images: ImageRecord[];
}

interface EmbeddedImage {
  image: PDFImage;
  width: number;
  height: number;
  caption?: string | null;
}

const margin = 72; // 2.5cm
const pageWidth = 612; // Letter size
const pageHeight = 792;

const primaryColor = rgb(0, 0, 0); // reemplazo azul por negro
const textColor = rgb(0.12, 0.16, 0.22); // #1f2937
const mutedColor = rgb(0.42, 0.45, 0.50); // #6b7280

const backgroundImageUrl = 'https://hpzfmcdmywofxioayiff.supabase.co/storage/v1/object/public/assets/Fondo%20PDF.jpg?download=1';

// Función global de normalización ULTRA AGRESIVA que se aplica ANTES de cualquier procesamiento
// Esta función es la ÚNICA fuente de verdad para normalización y debe ser IMPOSIBLE que escape un carácter problemático
// ESPECÍFICAMENTE diseñada para eliminar emojis como 📱 (0x1f4f1) y 📞 (0x1f4de)
const ULTRA_NORMALIZE = (text: any): string => {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') {
    try {
      text = String(text);
    } catch {
      return '';
    }
  }
  if (!text) return '';
  
  let str = String(text);
  
  // MÉTODO 1: Eliminar TODOS los pares sustitutos (emojis) usando regex MÚLTIPLES VECES
  // Los emojis se representan como dos caracteres en JavaScript (surrogate pairs)
  // High surrogate: 0xD800-0xDBFF, Low surrogate: 0xDC00-0xDFFF
  // Hacer esto 5 veces para asegurar que no quede NADA
  for (let i = 0; i < 5; i++) {
    // Eliminar pares sustitutos completos (emojis como 📱 0x1f4f1, 📞 0x1f4de, etc.)
    str = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
    // Eliminar cualquier surrogate suelto
    str = str.replace(/[\uD800-\uDFFF]/g, '');
  }
  
  // MÉTODO 1.5: Eliminación específica de emojis problemáticos conocidos usando su código Unicode
  // Convertir el código Unicode del emoji a su representación de par sustituto y eliminarlo
  // 📱 = U+1F4F1 = \uD83D\uDCF1
  // 📞 = U+1F4DE = \uD83D\uDCDE
  str = str.replace(/\uD83D\uDCF1/g, ''); // 📱 Mobile phone with arrows
  str = str.replace(/\uD83D\uDCDE/g, ''); // 📞 Telephone receiver
  str = str.replace(/\uD83D\uDCF2/g, ''); // 📲 Mobile phone with arrow
  str = str.replace(/\uD83D\uDCE9/g, ''); // 📩 Envelope with arrow
  str = str.replace(/\uD83D\uDCE7/g, ''); // 📧 E-mail
  str = str.replace(/\uD83D\uDCE8/g, ''); // 📨 Incoming envelope
  // Eliminar cualquier otro emoji común que pueda aparecer
  str = str.replace(/[\uD83C-\uD83E][\uDC00-\uDFFF]/g, ''); // Rango amplio de emojis
  // Eliminar TODOS los emojis posibles (rango completo de surrogates)
  str = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // Cualquier par sustituto
  str = str.replace(/[\uD800-\uDFFF]/g, ''); // Cualquier surrogate suelto
  
  // MÉTODO 2: Reemplazar caracteres problemáticos conocidos (múltiples variantes)
  // IMPORTANTE: Hacer esto ANTES de cualquier otro procesamiento
  str = str
    .replace(/\u2713/g, 'v')  // CHECK MARK (U+2713) -> v (√ checkmark)
    .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
    .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
    .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
    .replace(/\u2612/g, 'x')  // BALLOT BOX WITH X -> x
    .replace(/\u2717/g, 'x')  // BALLOT X -> x
    .replace(/\u2718/g, 'x')  // HEAVY BALLOT X -> x
    .replace(/\u221A/g, 'sqrt') // SQUARE ROOT (√) -> sqrt
    .replace(/\u221B/g, 'cbrt') // CUBE ROOT -> cbrt
    .replace(/\u221C/g, '4rt') // FOURTH ROOT -> 4rt
    // Eliminar cualquier variante del símbolo √ que pueda existir
    .replace(/√/g, 'sqrt') // Símbolo raíz cuadrada directo
    .replace(/\u221A/g, 'sqrt') // SQUARE ROOT Unicode
    .replace(/\u221B/g, 'cbrt') // CUBE ROOT
    .replace(/\u221C/g, '4rt'); // FOURTH ROOT
  
  // MÉTODO 3: Eliminar TODOS los caracteres fuera de WinAnsi usando regex MÚLTIPLES VECES
  // Hacer esto 5 veces para asegurar que no quede nada
  // IMPORTANTE: Eliminar específicamente √ y otros caracteres problemáticos primero
  for (let i = 0; i < 5; i++) {
    // Eliminar símbolos matemáticos problemáticos específicamente
    str = str.replace(/[√∛∜]/g, ''); // Eliminar símbolos de raíz
    str = str.replace(/[^\x00-\x7F\xA0-\xFF]/g, ''); // Eliminar todo fuera de ASCII y Latin-1
    str = str.replace(/[\x81\x8D\x8F\x90\x9D]/g, ''); // Eliminar controles problemáticos
  }
  
  // MÉTODO 4: Verificación final carácter por carácter (GARANTÍA ABSOLUTA)
  // Este es el paso final que garantiza que SOLO caracteres WinAnsi válidos pasen
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    
    // PRIMERO: Verificar si es un surrogate (nunca debería llegar aquí después de MÉTODO 1, pero por seguridad)
    if (code >= 0xD800 && code <= 0xDFFF) {
      // Es un surrogate, saltarlo completamente
      continue;
    }
    
    // SEGUNDO: Eliminar caracteres problemáticos específicos (√, checkmarks, etc.)
    if (code === 0x2713 || code === 0x2714 || code === 0x2705 || // Checkmarks
        code === 0x2611 || code === 0x2612 || // Ballot boxes
        code === 0x2717 || code === 0x2718 || // X marks
        code === 0x221A || code === 0x221B || code === 0x221C) { // Root symbols
      // Reemplazar con caracteres seguros
      if (code === 0x221A || code === 0x221B || code === 0x221C) {
        result += 'sqrt';
      } else if (code === 0x2713 || code === 0x2714 || code === 0x2705 || code === 0x2611) {
        result += 'v';
      } else {
        result += 'x';
      }
      continue;
    }
    
    // TERCERO: Solo permitir caracteres WinAnsi válidos
    if (code <= 127) {
      // ASCII completo (0-127)
      result += str[i];
    } else if (code >= 160 && code <= 255 && 
               code !== 0x81 && code !== 0x8D && code !== 0x8F && 
               code !== 0x90 && code !== 0x9D) {
      // Latin-1 válido (160-255, excluyendo controles problemáticos)
      result += str[i];
    }
    // Cualquier otro carácter se IGNORA (no se agrega a result)
  }
  
  // MÉTODO 5: Verificación final de seguridad (por si acaso algo escapó)
  // Convertir a array de códigos y filtrar, eliminando CUALQUIER cosa fuera de WinAnsi
  const finalCheck = result.split('').filter((char) => {
    const code = char.charCodeAt(0);
    // Eliminar cualquier surrogate que haya escapado
    if (code >= 0xD800 && code <= 0xDFFF) {
      return false;
    }
    // Solo permitir WinAnsi válido
    return code <= 127 || (code >= 160 && code <= 255 && 
           code !== 0x81 && code !== 0x8D && code !== 0x8F && 
           code !== 0x90 && code !== 0x9D);
  }).join('');
  
  return finalCheck;
};

export async function createProposalPDF({
  proposal,
  items,
  equipment,
  images,
}: CreateProposalPDFParams): Promise<Uint8Array> {
  // Normalizar TODOS los datos de entrada ANTES de crear el PDF
  const normalizeData = (data: any): any => {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      return ULTRA_NORMALIZE(data);
    }
    if (typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map(normalizeData);
      }
      const normalized: any = {};
      for (const key in data) {
        normalized[key] = normalizeData(data[key]);
      }
      return normalized;
    }
    return data;
  };

  const normalizedProposal = normalizeData(proposal);
  const normalizedItems = normalizeData(items);
  const normalizedEquipment = normalizeData(equipment);
  const normalizedImages = normalizeData(images);

  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const embeddedImages = await loadProposalImages(pdfDoc, normalizedImages);
  const backgroundImage = await loadBackgroundImage(pdfDoc);

  await generatePDFContent({
    pdfDoc,
    helvetica,
    helveticaBold,
    proposal: normalizedProposal,
    items: normalizedItems,
    equipment: normalizedEquipment,
    images: embeddedImages,
    backgroundImage,
  });

  // Intentar guardar el PDF con protección adicional
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await pdfDoc.save();
  } catch (error: any) {
    // Si falla por error de codificación, intentar una última vez con datos completamente normalizados
    console.warn('Error al guardar PDF, reintentando con normalización adicional:', error);
    
    // Re-normalizar todos los datos de forma aún más agresiva
    const ultraNormalizeData = (data: any): any => {
      if (data === null || data === undefined) return data;
      if (typeof data === 'string') {
        // Convertir a ASCII puro como último recurso
        return ULTRA_NORMALIZE(data).split('').map((char: string) => {
          const code = char.charCodeAt(0);
          return code <= 127 ? char : '?';
        }).join('');
      }
      if (typeof data === 'object') {
        if (Array.isArray(data)) {
          return data.map(ultraNormalizeData);
        }
        const normalized: any = {};
        for (const key in data) {
          normalized[key] = ultraNormalizeData(data[key]);
        }
        return normalized;
      }
      return data;
    };

    // Crear un nuevo PDF con datos ultra-normalizados
    const newPdfDoc = await PDFDocument.create();
    const newHelveticaBold = await newPdfDoc.embedFont(StandardFonts.HelveticaBold);
    const newHelvetica = await newPdfDoc.embedFont(StandardFonts.Helvetica);
    const newEmbeddedImages = await loadProposalImages(newPdfDoc, ultraNormalizeData(normalizedImages));
    const newBackgroundImage = await loadBackgroundImage(newPdfDoc);

    await generatePDFContent({
      pdfDoc: newPdfDoc,
      helvetica: newHelvetica,
      helveticaBold: newHelveticaBold,
      proposal: ultraNormalizeData(normalizedProposal),
      items: ultraNormalizeData(normalizedItems),
      equipment: ultraNormalizeData(normalizedEquipment),
      images: newEmbeddedImages,
      backgroundImage: newBackgroundImage,
    });

    pdfBytes = await newPdfDoc.save();
  }

  return pdfBytes;
}

async function loadProposalImages(pdfDoc: PDFDocument, images: ImageRecord[]): Promise<EmbeddedImage[]> {
  const embedded: EmbeddedImage[] = [];

  for (const image of images) {
    try {
      const response = await fetch(image.image_url);
      if (!response.ok) {
        console.warn(`No se pudo descargar la imagen: ${image.image_url}`);
        continue;
      }

      const contentType = response.headers.get('content-type') ?? '';
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let pdfImage: PDFImage;
      if (contentType.includes('png') || image.image_url.endsWith('.png')) {
        pdfImage = await pdfDoc.embedPng(bytes);
      } else {
        pdfImage = await pdfDoc.embedJpg(bytes);
      }

      embedded.push({
        image: pdfImage,
        width: pdfImage.width,
        height: pdfImage.height,
        caption: image.image_caption ? ULTRA_NORMALIZE(image.image_caption) : null,
      });
    } catch (error) {
      console.error(`Error incorporando imagen ${image.image_url}:`, error);
    }
  }

  return embedded;
}

interface GenerateContentParams {
  pdfDoc: PDFDocument;
  helvetica: any;
  helveticaBold: any;
  proposal: ProposalRecord;
  items: ItemRecord[];
  equipment: EquipmentRecord[];
  images: EmbeddedImage[];
  backgroundImage: PDFImage | null;
}

async function generatePDFContent({
  pdfDoc,
  helvetica,
  helveticaBold,
  proposal,
  items,
  equipment,
  images,
  backgroundImage,
}: GenerateContentParams) {
  // Función de normalización temprana para limpiar todos los datos de entrada
  const earlyNormalize = (value: any): any => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      return ULTRA_NORMALIZE(value);
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(earlyNormalize);
      }
      const normalized: any = {};
      for (const key in value) {
        normalized[key] = earlyNormalize(value[key]);
      }
      return normalized;
    }
    return value;
  };

  // Normalizar todos los datos de entrada ANTES de procesarlos
  const normalizedProposal = earlyNormalize(proposal);
  const normalizedItems = earlyNormalize(items);
  const normalizedEquipment = earlyNormalize(equipment);
  
  // Envolver las fuentes para interceptar widthOfTextAtSize
  // Función para envolver el objeto font y interceptar todas las llamadas a widthOfTextAtSize
  // Esta es la ÚLTIMA línea de defensa para cálculos de ancho - debe ser IMPOSIBLE que escape un carácter problemático
  const wrapFont = (font: any): any => {
    const originalWidthOfTextAtSize = font.widthOfTextAtSize.bind(font);
    
    // Interceptar widthOfTextAtSize y normalizar el texto automáticamente usando ULTRA_NORMALIZE
    font.widthOfTextAtSize = (text: string | number | any, size: number) => {
      // PASO 0: Convertir a string
      let textStr = '';
      if (text === null || text === undefined) {
        textStr = '';
      } else if (typeof text === 'number') {
        textStr = String(text);
      } else if (typeof text !== 'string') {
        try {
          textStr = String(text);
        } catch {
          textStr = '';
        }
      } else {
        textStr = text;
      }
      
      // PASO 1: Normalizar con ULTRA_NORMALIZE (ya muy agresiva)
      let normalized = ULTRA_NORMALIZE(textStr);
      
      // PASO 2: Eliminación específica y múltiple de 0x2713 (CHECK MARK)
      for (let i = 0; i < 5; i++) {
        normalized = normalized
          .replace(/\u2713/g, 'v')  // CHECK MARK -> v
          .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
          .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
          .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
          .replace(/\u221A/g, 'sqrt') // SQUARE ROOT -> sqrt
          .replace(/√/g, 'sqrt'); // Símbolo raíz cuadrada directo
      }
      
      // PASO 3: Verificación final carácter por carácter
      let finalText = '';
      for (let i = 0; i < normalized.length; i++) {
        const code = normalized.charCodeAt(i);
        // Eliminar específicamente 0x2713 y otros caracteres problemáticos
        if (code === 0x2713 || code === 0x2714 || code === 0x2705 || 
            code === 0x2611 || code === 0x221A || code === 0x221B || code === 0x221C) {
          if (code === 0x221A || code === 0x221B || code === 0x221C) {
            finalText += 'sqrt';
          } else {
            finalText += 'v';
          }
        } else if (code <= 127 || (code >= 160 && code <= 255 && 
                   code !== 0x81 && code !== 0x8D && code !== 0x8F && 
                   code !== 0x90 && code !== 0x9D)) {
          finalText += normalized[i];
        }
        // Cualquier otro carácter se ignora
      }
      
      // PASO 4: Intentar calcular el ancho
      try {
        return originalWidthOfTextAtSize(finalText, size);
      } catch (error: any) {
        // Si falla, el problema podría ser un carácter que no capturamos
        // Convertir a ASCII puro como fallback
        const asciiOnly = finalText.split('').map((char: string) => {
          const code = char.charCodeAt(0);
          // Eliminar específicamente 0x2713
          if (code === 0x2713 || code === 0x2714 || code === 0x2705 || code === 0x2611) {
            return 'v';
          }
          return code <= 127 ? char : '?';
        }).join('');
        
        try {
          return originalWidthOfTextAtSize(asciiOnly, size);
        } catch (error2: any) {
          // Si aún falla, retornar 0 para evitar crashear
          console.error('Error crítico calculando ancho de texto después de múltiples intentos:', {
            originalText: text?.substring(0, 50),
            normalized: normalized?.substring(0, 50),
            asciiOnly: asciiOnly?.substring(0, 50),
            error: error?.message || error,
            error2: error2?.message || error2
          });
          // Retornar 0 para evitar crashear el PDF
          return 0;
        }
      }
    };
    
    return font;
  };

  const arial = wrapFont(helvetica);
  const arialBold = wrapFont(helveticaBold);
  const helveticaWrapped = wrapFont(helvetica);
  const helveticaBoldWrapped = wrapFont(helveticaBold);
  const equipmentImageCache = new Map<string, PDFImage>();

  const embedImageFromUrl = async (url: string): Promise<PDFImage | null> => {
    if (!url) return null;
    const normalizedUrl = url.trim();
    if (!normalizedUrl) return null;

    if (equipmentImageCache.has(normalizedUrl)) {
      return equipmentImageCache.get(normalizedUrl) ?? null;
    }

    try {
      const response = await fetch(normalizedUrl);
      if (!response.ok) {
        console.warn(`No se pudo descargar la imagen del equipo: ${normalizedUrl}`);
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let pdfImage: PDFImage;
      if (contentType.includes('png') || normalizedUrl.toLowerCase().endsWith('.png')) {
        pdfImage = await pdfDoc.embedPng(bytes);
      } else {
        pdfImage = await pdfDoc.embedJpg(bytes);
      }

      equipmentImageCache.set(normalizedUrl, pdfImage);
      return pdfImage;
    } catch (error) {
      console.error(`Error incrustando imagen del equipo ${normalizedUrl}:`, error);
      return null;
    }
  };

  // Normaliza texto para WinAnsi encoding (reemplaza caracteres Unicode no soportados)
  // DEBE estar definida antes de stripHTML y wrapText
  const normalizeForWinAnsi = (text: string): string => {
    // Usar la función ULTRA_NORMALIZE para máxima seguridad
    return ULTRA_NORMALIZE(text);
  };

  // Función wrapper para drawText que siempre normaliza el texto
  const safeDrawText = (page: any, text: string, options: any) => {
    // El page ya está envuelto, así que drawText normaliza automáticamente
    // Pero aún así normalizamos aquí por seguridad usando ULTRA_NORMALIZE
    const normalizedText = ULTRA_NORMALIZE(text || '');
    page.drawText(normalizedText, options);
  };

  // Función wrapper para widthOfTextAtSize que siempre normaliza el texto
  const safeWidthOfTextAtSize = (font: any, text: string, size: number): number => {
    if (!text) return 0;
    // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
    // Pero aún así normalizamos aquí por seguridad usando ULTRA_NORMALIZE
    const normalizedText = ULTRA_NORMALIZE(text);
    return font.widthOfTextAtSize(normalizedText, size);
  };

  const stripHTML = (html: string) => {
    if (!html) return '';
    let stripped = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    // PRIMERO: Reemplazar entidades HTML problemáticas conocidas ANTES de decodificar
    // Esto evita que caracteres como √ (0x2713) o emojis se decodifiquen y causen problemas
    stripped = stripped
      .replace(/&#x2713;/gi, 'v')  // CHECK MARK -> v
      .replace(/&#10003;/gi, 'v')  // CHECK MARK (decimal) -> v
      .replace(/&#x2714;/gi, 'v')  // HEAVY CHECK MARK -> v
      .replace(/&#10004;/gi, 'v')  // HEAVY CHECK MARK (decimal) -> v
      .replace(/&#x2705;/gi, 'v')  // WHITE HEAVY CHECK MARK -> v
      .replace(/&#9989;/gi, 'v')   // WHITE HEAVY CHECK MARK (decimal) -> v
      .replace(/&#x2611;/gi, 'v')  // BALLOT BOX WITH CHECK -> v
      .replace(/&#9745;/gi, 'v')   // BALLOT BOX WITH CHECK (decimal) -> v
      .replace(/&#x221A;/gi, 'sqrt') // SQUARE ROOT -> sqrt
      .replace(/&#8730;/gi, 'sqrt')  // SQUARE ROOT (decimal) -> sqrt
      // Eliminar emojis comunes codificados como entidades HTML (si existen)
      .replace(/&#x1f4de;/gi, '')   // 📞 (phone emoji) -> eliminar
      .replace(/&#128222;/gi, '')   // 📞 (phone emoji decimal) -> eliminar
      .replace(/&#x1f4f1;/gi, '')   // 📱 (mobile phone) -> eliminar
      .replace(/&#128241;/gi, '');  // 📱 (mobile phone decimal) -> eliminar
    
    // SEGUNDO: Decodificar entidades HTML numéricas (hex y decimal) restantes
    // PERO solo si el código es seguro (dentro de WinAnsi)
    stripped = stripped
      .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
        const code = parseInt(hex, 16);
        // Solo decodificar si está en el rango WinAnsi seguro
        if (code <= 127 || (code >= 160 && code <= 255 && 
            code !== 0x81 && code !== 0x8D && code !== 0x8F && 
            code !== 0x90 && code !== 0x9D)) {
          return String.fromCharCode(code);
        }
        // Si está fuera del rango seguro, eliminar la entidad
        return '';
      })
      .replace(/&#(\d+);/g, (match, dec) => {
        const code = parseInt(dec, 10);
        // Solo decodificar si está en el rango WinAnsi seguro
        if (code <= 127 || (code >= 160 && code <= 255 && 
            code !== 0x81 && code !== 0x8D && code !== 0x8F && 
            code !== 0x90 && code !== 0x9D)) {
          return String.fromCharCode(code);
        }
        // Si está fuera del rango seguro, eliminar la entidad
        return '';
      });
    
    // TERCERO: Decodificar entidades HTML comunes
    stripped = stripped
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // CUARTO: Normalizar después de limpiar HTML para manejar cualquier carácter especial restante
    return normalizeForWinAnsi(stripped);
  };

  const wrapText = (text: string, font: any, size: number, maxWidth: number) => {
    const normalized = normalizeForWinAnsi(text);
    const sanitized = normalized.replace(/\s+/g, ' ').trim();
    if (!sanitized) return [];

    const words = sanitized.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
      const candidateWidth = font.widthOfTextAtSize(candidate, size);

      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      let splitWord = word;
      // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
      while (font.widthOfTextAtSize(splitWord, size) > maxWidth && splitWord.length > 1) {
        let sliceIndex = splitWord.length - 1;
        while (sliceIndex > 1 && font.widthOfTextAtSize(splitWord.slice(0, sliceIndex), size) > maxWidth) {
          sliceIndex--;
        }
        const segment = splitWord.slice(0, sliceIndex);
        if (segment) {
          lines.push(segment);
        }
        splitWord = splitWord.slice(sliceIndex);
      }

      currentLine = splitWord;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const drawParagraph = ({
    page,
    text,
    x,
    y,
    font,
    size,
    color,
    lineHeight,
    maxWidth,
    maxLines,
    alignment = 'left',
    lineHeightMultiplier = 1.2,
  }: {
    page: any;
    text: string;
    x: number;
    y: number;
    font: any;
    size: number;
    color: any;
    lineHeight?: number;
    maxWidth: number;
    maxLines?: number;
    alignment?: 'left' | 'right' | 'center' | 'justify';
    lineHeightMultiplier?: number;
  }) => {
    if (!text) return y;

    const normalizedText = normalizeForWinAnsi(text);
    const rawLines = normalizedText.split('\n');
    let remainingY = y;
    const allLines: string[] = [];
    const actualLineHeight = lineHeight ?? size * lineHeightMultiplier;

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed) {
        allLines.push('');
        continue;
      }
      const wrapped = wrapText(trimmed, font, size, maxWidth);
      if (wrapped.length === 0) {
        allLines.push('');
      } else {
        allLines.push(...wrapped);
      }
    }

    const lines = typeof maxLines === 'number' ? allLines.slice(0, maxLines) : allLines;

    const drawJustifiedLine = (line: string, baselineY: number) => {
      const normalizedLine = normalizeForWinAnsi(line);
      const words = normalizedLine.split(' ');
      if (words.length <= 1) {
        safeDrawText(page, normalizedLine, { x, y: baselineY, size, font, color });
        return;
      }

      // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
      const wordsWidth = words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0);
      const extraSpace = maxWidth - wordsWidth;
      if (extraSpace <= 0) {
        safeDrawText(page, normalizedLine, { x, y: baselineY, size, font, color });
        return;
      }

      const gapWidth = extraSpace / (words.length - 1);
      let cursorX = x;
      for (let i = 0; i < words.length; i++) {
        const word = normalizeForWinAnsi(words[i]); // Asegurar normalización de cada palabra
        safeDrawText(page, word, { x: cursorX, y: baselineY, size, font, color });
        // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
        cursorX += font.widthOfTextAtSize(word, size);
        if (i < words.length - 1) {
          cursorX += gapWidth;
        }
      }
    };

    lines.forEach((line, idx) => {
      if (remainingY < margin + actualLineHeight) {
        return;
      }

      if (line === '') {
        remainingY -= actualLineHeight;
        return;
      }

      const isLastLine = idx === lines.length - 1;
      const normalizedLine = normalizeForWinAnsi(line);
      // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
      const textWidth = font.widthOfTextAtSize(normalizedLine, size);

      if (alignment === 'right') {
        const offsetX = x + Math.max(0, maxWidth - textWidth);
        safeDrawText(page, normalizedLine, { x: offsetX, y: remainingY, size, font, color });
      } else if (alignment === 'center') {
        const offsetX = x + Math.max(0, (maxWidth - textWidth) / 2);
        safeDrawText(page, normalizedLine, { x: offsetX, y: remainingY, size, font, color });
      } else if (alignment === 'justify' && !isLastLine) {
        drawJustifiedLine(line, remainingY);
      } else {
        safeDrawText(page, normalizedLine, { x, y: remainingY, size, font, color });
      }

      remainingY -= actualLineHeight;
    });

    return remainingY;
  };

  const addFooter = (page: any, pageNum: number, totalPages: number) => {
    safeDrawText(page, normalizeForWinAnsi('Soldgrup - La fuerza de su industria | www.soldgrup.com'), {
      x: margin,
      y: 40,
      size: 8,
      font: helveticaWrapped,
      color: mutedColor,
    });
    safeDrawText(page, normalizeForWinAnsi(`Página ${pageNum} de ${totalPages}`), {
      x: pageWidth / 2 - 30,
      y: 25,
      size: 8,
      font: helveticaWrapped,
      color: mutedColor,
    });
  };

  // PAGE 1: Cover Page
  const drawBackground = (page: any) => {
    if (!backgroundImage) return;
    const widthScale = pageWidth / backgroundImage.width;
    const heightScale = pageHeight / backgroundImage.height;
    const scale = Math.max(widthScale, heightScale);
    const imgWidth = backgroundImage.width * scale;
    const imgHeight = backgroundImage.height * scale;
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - imgHeight) / 2;

    page.drawImage(backgroundImage, {
      x,
      y,
      width: imgWidth,
      height: imgHeight,
    });
  };

  // Función para envolver el objeto page y interceptar todas las llamadas a drawText
  // Esta es la ÚLTIMA línea de defensa - debe ser IMPOSIBLE que escape un carácter problemático
  const wrapPage = (page: any): any => {
    const originalDrawText = page.drawText.bind(page);
    
    // Interceptar drawText y normalizar el texto automáticamente usando ULTRA_NORMALIZE
    page.drawText = (text: string | number | any, options: any) => {
      // PASO 0: Convertir a string si no lo es
      let textStr = '';
      if (text === null || text === undefined) {
        textStr = '';
      } else if (typeof text === 'number') {
        textStr = String(text);
      } else if (typeof text !== 'string') {
        try {
          textStr = String(text);
        } catch {
          textStr = '';
        }
      } else {
        textStr = text;
      }
      
      // PASO 1: Normalizar con ULTRA_NORMALIZE (ya muy agresiva)
      let normalized = ULTRA_NORMALIZE(textStr);
      
      // PASO 2: Verificación adicional - eliminar específicamente 0x2713 (CHECK MARK)
      // Hacer esto múltiples veces para asegurar
      for (let i = 0; i < 3; i++) {
        normalized = normalized
          .replace(/\u2713/g, 'v')  // CHECK MARK -> v
          .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
          .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
          .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
          .replace(/\u221A/g, 'sqrt') // SQUARE ROOT -> sqrt
          .replace(/√/g, 'sqrt'); // Símbolo raíz cuadrada directo
      }
      
      // PASO 3: Verificación final carácter por carácter
      let finalText = '';
      for (let i = 0; i < normalized.length; i++) {
        const code = normalized.charCodeAt(i);
        // Eliminar específicamente 0x2713 y otros caracteres problemáticos
        if (code === 0x2713 || code === 0x2714 || code === 0x2705 || 
            code === 0x2611 || code === 0x221A || code === 0x221B || code === 0x221C) {
          if (code === 0x221A || code === 0x221B || code === 0x221C) {
            finalText += 'sqrt';
          } else {
            finalText += 'v';
          }
        } else if (code <= 127 || (code >= 160 && code <= 255 && 
                   code !== 0x81 && code !== 0x8D && code !== 0x8F && 
                   code !== 0x90 && code !== 0x9D)) {
          finalText += normalized[i];
        }
        // Cualquier otro carácter se ignora
      }
      
      // PASO 4: Intentar dibujar con el texto final normalizado
      try {
        return originalDrawText(finalText, options);
      } catch (error: any) {
        // Si aún falla, convertir a ASCII puro como último recurso
        const asciiOnly = finalText.split('').map((char: string) => {
          const code = char.charCodeAt(0);
          return code <= 127 ? char : '?';
        }).join('');
        
        try {
          return originalDrawText(asciiOnly, options);
        } catch (error2: any) {
          // Si aún falla, intentar con string vacío
          try {
            return originalDrawText('', options);
          } catch {
            // Si TODO falla, al menos no crashear - retornar sin dibujar
            console.error('Error crítico dibujando texto después de múltiples intentos:', {
              originalText: text?.substring(0, 50),
              normalized: normalized?.substring(0, 50),
              asciiOnly: asciiOnly?.substring(0, 50),
              error: error?.message || error,
              error2: error2?.message || error2
            });
            // Retornar sin dibujar nada para evitar crashear el PDF
            return;
          }
        }
      }
    };
    
    return page;
  };

  // También envolver los fonts para interceptar widthOfTextAtSize
  const wrapFont = (font: any): any => {
    const originalWidthOfTextAtSize = font.widthOfTextAtSize?.bind(font);
    if (originalWidthOfTextAtSize) {
      font.widthOfTextAtSize = (text: string | number | any, size: number) => {
        let textStr = '';
        if (text === null || text === undefined) {
          textStr = '';
        } else if (typeof text === 'number') {
          textStr = String(text);
        } else if (typeof text !== 'string') {
          try {
            textStr = String(text);
          } catch {
            textStr = '';
          }
        } else {
          textStr = text;
        }
        
        // Normalizar el texto antes de calcular el ancho
        const normalized = ULTRA_NORMALIZE(textStr);
        // Eliminar específicamente 0x2713
        const cleaned = normalized
          .replace(/\u2713/g, 'v')
          .replace(/\u2714/g, 'v')
          .replace(/\u2705/g, 'v')
          .replace(/\u2611/g, 'v')
          .replace(/\u221A/g, 'sqrt')
          .replace(/√/g, 'sqrt');
        
        return originalWidthOfTextAtSize(cleaned, size);
      };
    }
    return font;
  };

  const createPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawBackground(page);
    return wrapPage(page); // Envolver la página para interceptar drawText
  };

  let page = createPage();
  let y = pageHeight - margin - 40;
  const baseSize = 11;
  const lineHeight = 16;
  const black = rgb(0, 0, 0);
  const contentWidth = pageWidth - margin * 2;

  const addBlankLines = (count: number) => {
    y -= lineHeight * count;
  };

  const proposalId = normalizeForWinAnsi(normalizedProposal.offer_id || 'N/A');
  // El font ya está envuelto, así que widthOfTextAtSize normaliza automáticamente
  const proposalIdWidth = arialBold.widthOfTextAtSize(proposalId, baseSize);
  safeDrawText(page, proposalId, {
    x: pageWidth - margin - proposalIdWidth,
    y,
    size: baseSize,
    font: arialBold,
    color: black,
  });
  y -= lineHeight;

  const date = normalizedProposal.presentation_date ? new Date(normalizedProposal.presentation_date) : null;
  const dateStr = date
    ? normalizeForWinAnsi(date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }))
    : '';
  const cityLine = normalizeForWinAnsi(dateStr ? `Pereira, ${dateStr}` : 'Pereira,');
  safeDrawText(page, cityLine, {
    x: margin,
    y,
    size: baseSize,
    font: arial,
    color: black,
  });
  y -= lineHeight;

  addBlankLines(4);

  safeDrawText(page, normalizeForWinAnsi('Señores.'), {
    x: margin,
    y,
    size: baseSize,
    font: arial,
    color: black,
  });
  y -= lineHeight;

  const clientName = normalizeForWinAnsi(normalizedProposal.client || '');
  if (clientName) {
    safeDrawText(page, clientName, {
      x: margin,
      y,
      size: baseSize,
      font: arial,
      color: black,
    });
    y -= lineHeight;
  }

  addBlankLines(4);

  const referenceText = stripHTML(normalizedProposal.reference ?? '');
  if (referenceText) {
    y = drawParagraph({
      page,
      text: `Referencia: ${referenceText}`,
      x: margin,
      y,
      font: arialBold,
      size: baseSize,
      color: black,
      maxWidth: contentWidth,
      alignment: 'justify',
      lineHeightMultiplier: 1,
    });
  } else {
    safeDrawText(page, normalizeForWinAnsi('Referencia:'), {
      x: margin,
      y,
      size: baseSize,
      font: arialBold,
      color: black,
    });
    y -= lineHeight;
  }

  addBlankLines(4);

  const introParagraph =
    'De acuerdo con su solicitud, presento para su análisis y consideración, la propuesta para el suministro en referencia. Esperamos que la propuesta técnico-económica cumpla con todas las expectativas que usted requiere. Cualquier consulta sobre este particular, gustosamente será resuelta a la mayor brevedad.';
  y = drawParagraph({
    page,
    text: introParagraph,
    x: margin,
    y,
    font: arial,
    size: baseSize,
    color: black,
    lineHeight,
    maxWidth: contentWidth,
    alignment: 'justify',
  });

  addBlankLines(2);

  safeDrawText(page, normalizeForWinAnsi('Cordialmente,'), {
    x: margin,
    y,
    size: baseSize,
    font: arial,
    color: black,
  });
  y -= lineHeight;

  addBlankLines(3);

  const soldgrupContact = stripHTML(normalizedProposal.soldgrup_contact ?? '');
  if (soldgrupContact) {
    y = drawParagraph({
      page,
      text: soldgrupContact,
      x: margin,
      y,
      font: arial,
      size: baseSize,
      color: black,
      lineHeight,
      maxWidth: contentWidth,
    });
  }

  // PAGE 3+: Commercial Offer
  if (normalizedItems.length > 0) {
    page = createPage();
    y = pageHeight - margin - 40;

    safeDrawText(page, normalizeForWinAnsi('OFERTA COMERCIAL'), {
      x: margin,
      y: y,
      size: 18,
      font: helveticaBoldWrapped,
      color: primaryColor,
    });
    y -= 40;

    const colWidths = [40, 200, 70, 90, 90];
    const startX = margin;
    const headerHeight = 25;

    page.drawRectangle({
      x: startX,
      y: y - headerHeight,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: headerHeight,
      color: primaryColor,
    });

    safeDrawText(page, normalizeForWinAnsi('Item'), { x: startX + 5, y: y - 17, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
    safeDrawText(page, normalizeForWinAnsi('Descripción'), {
      x: startX + colWidths[0] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBoldWrapped,
      color: rgb(1, 1, 1),
    });
    safeDrawText(page, normalizeForWinAnsi('Cant.'), {
      x: startX + colWidths[0] + colWidths[1] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBoldWrapped,
      color: rgb(1, 1, 1),
    });
    safeDrawText(page, normalizeForWinAnsi('P. Unit.'), {
      x: startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBoldWrapped,
      color: rgb(1, 1, 1),
    });
    safeDrawText(page, normalizeForWinAnsi('P. Total'), {
      x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBoldWrapped,
      color: rgb(1, 1, 1),
    });

    y -= headerHeight;

    for (const item of normalizedItems) {
      const desc = stripHTML(item.description ?? '');
      const descriptionLines = wrapText(desc, helvetica, 8, colWidths[1] - 10);
      const rowHeight = Math.max(30, descriptionLines.length * 12 + 8);

      if (y - rowHeight < 100) {
        page = createPage();
        y = pageHeight - margin;
        safeDrawText(page, normalizeForWinAnsi('OFERTA COMERCIAL'), {
          x: margin,
          y: y,
          size: 18,
          font: helveticaBoldWrapped,
          color: primaryColor,
        });
        y -= 40;

        page.drawRectangle({
          x: startX,
          y: y - headerHeight,
          width: colWidths.reduce((a, b) => a + b, 0),
          height: headerHeight,
          color: primaryColor,
        });

        safeDrawText(page, normalizeForWinAnsi('Item'), { x: startX + 5, y: y - 17, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
        safeDrawText(page, normalizeForWinAnsi('Descripción'), {
          x: startX + colWidths[0] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBoldWrapped,
          color: rgb(1, 1, 1),
        });
        safeDrawText(page, normalizeForWinAnsi('Cant.'), {
          x: startX + colWidths[0] + colWidths[1] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBoldWrapped,
          color: rgb(1, 1, 1),
        });
        safeDrawText(page, normalizeForWinAnsi('P. Unit.'), {
          x: startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBoldWrapped,
          color: rgb(1, 1, 1),
        });
        safeDrawText(page, normalizeForWinAnsi('P. Total'), {
          x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBoldWrapped,
          color: rgb(1, 1, 1),
        });

        y -= headerHeight;
      }

      page.drawRectangle({
        x: startX,
        y: y - rowHeight,
        width: colWidths[0],
        height: rowHeight,
        borderColor: rgb(0.9, 0.91, 0.92),
        borderWidth: 1,
      });

      safeDrawText(page,normalizeForWinAnsi(String(item.item_number ?? '')), {
        x: startX + 5,
        y: y - 17,
        size: 9,
        font: helveticaWrapped,
        color: textColor,
      });

      page.drawRectangle({
        x: startX + colWidths[0],
        y: y - rowHeight,
        width: colWidths[1],
        height: rowHeight,
        borderColor: rgb(0.9, 0.91, 0.92),
        borderWidth: 1,
      });

      let descriptionY = y - 14;
      for (const line of descriptionLines) {
        safeDrawText(page,normalizeForWinAnsi(line), {
          x: startX + colWidths[0] + 5,
          y: descriptionY,
          size: 8,
          font: helveticaWrapped,
          color: textColor,
        });
        descriptionY -= 12;
      }

      page.drawRectangle({
        x: startX + colWidths[0] + colWidths[1],
        y: y - rowHeight,
        width: colWidths[2],
        height: rowHeight,
        borderColor: rgb(0.9, 0.91, 0.92),
        borderWidth: 1,
      });

      safeDrawText(page,normalizeForWinAnsi(`${item.quantity ?? ''} ${item.unit ?? ''}`.trim()), {
        x: startX + colWidths[0] + colWidths[1] + 5,
        y: y - 17,
        size: 9,
        font: helveticaWrapped,
        color: textColor,
      });

      page.drawRectangle({
        x: startX + colWidths[0] + colWidths[1] + colWidths[2],
        y: y - rowHeight,
        width: colWidths[3],
        height: rowHeight,
        borderColor: rgb(0.9, 0.91, 0.92),
        borderWidth: 1,
      });

      // Normalizar el resultado de toLocaleString ya que puede generar caracteres especiales
      const unitPriceFormatted = normalizeForWinAnsi(`$${Number(item.unit_price ?? 0).toLocaleString('es-CO')}`);
      safeDrawText(page, unitPriceFormatted, {
        x: startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
        y: y - 17,
        size: 9,
        font: helveticaWrapped,
        color: textColor,
      });

      page.drawRectangle({
        x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        y: y - rowHeight,
        width: colWidths[4],
        height: rowHeight,
        borderColor: rgb(0.9, 0.91, 0.92),
        borderWidth: 1,
      });

      // Normalizar el resultado de toLocaleString ya que puede generar caracteres especiales
      const totalPriceFormatted = normalizeForWinAnsi(`$${Number(item.total_price ?? 0).toLocaleString('es-CO')}`);
      safeDrawText(page, totalPriceFormatted, {
        x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
        y: y - 17,
        size: 9,
        font: helveticaWrapped,
        color: textColor,
      });

      y -= rowHeight;
    }

    const total = normalizedItems.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);
    y -= 20;

    safeDrawText(page,normalizeForWinAnsi('Valor total Antes de IVA:'), {
      x: startX + 250,
      y,
      size: 11,
      font: helveticaBoldWrapped,
      color: textColor,
    });
    safeDrawText(page,normalizeForWinAnsi(`$${total.toLocaleString('es-CO')}`), {
      x: startX + 410,
      y,
      size: 12,
      font: helveticaBoldWrapped,
      color: primaryColor,
    });
  }

  if (normalizedProposal.observations) {
    page = createPage();
    y = pageHeight - margin - 40;

    safeDrawText(page,normalizeForWinAnsi('Observaciones'), { x: margin, y, size: 18, font: helveticaBold, color: primaryColor });
    y -= 40;

    const obsText = stripHTML(normalizedProposal.observations);
    const obsLines = obsText.split('\n').slice(0, 30);
    for (const line of obsLines) {
      if (y < 100) break;
      safeDrawText(page,normalizeForWinAnsi(line.substring(0, 80)), { x: margin, y, size: 10, font: helvetica, color: textColor });
      y -= 15;
    }
  }

  if (images.length > 0) {
    const maxImageWidth = (pageWidth - margin * 2 - 20) / 2;
    const maxImageHeight = 180;
    const gap = 20;
    let rowHeight = 0;

    const startImagesPage = () => {
      rowHeight = 0;
      page = createPage();
      y = pageHeight - margin - 40;
      safeDrawText(page,normalizeForWinAnsi('Galería de Imágenes'), {
        x: margin,
        y,
        size: 18,
        font: helveticaBoldWrapped,
        color: primaryColor,
      });
      y -= 40;
    };

    startImagesPage();
    let x = margin;

    for (const embeddedImage of images) {
      const scale = Math.min(maxImageWidth / embeddedImage.width, maxImageHeight / embeddedImage.height, 1);
      const imgWidth = embeddedImage.width * scale;
      const imgHeight = embeddedImage.height * scale;
      const captionHeight = embeddedImage.caption ? 16 : 0;
      rowHeight = Math.max(rowHeight, imgHeight + captionHeight + 10);

      if (x + imgWidth > pageWidth - margin) {
        x = margin;
        y -= rowHeight + gap;
        rowHeight = imgHeight + captionHeight + 10;
      }

      if (y - imgHeight - captionHeight < margin) {
        startImagesPage();
        x = margin;
        rowHeight = imgHeight + captionHeight + 10;
      }

      page.drawImage(embeddedImage.image, {
        x,
        y: y - imgHeight,
        width: imgWidth,
        height: imgHeight,
      });

      if (embeddedImage.caption) {
        // Normalizar el caption ANTES de dibujarlo (doble normalización por seguridad)
        const normalizedCaption = ULTRA_NORMALIZE(embeddedImage.caption.substring(0, 80));
        safeDrawText(page, normalizedCaption, {
          x,
          y: y - imgHeight - 12,
          size: 9,
          font: helveticaWrapped,
          color: mutedColor,
        });
      }

      x += maxImageWidth + gap;
    }
  }

  if (normalizedProposal.technical_specs_table && normalizedProposal.technical_specs_table.length > 0) {
    page = createPage();
    y = pageHeight - margin - 40;

    safeDrawText(page,normalizeForWinAnsi('Especificaciones Técnicas'), {
      x: margin,
      y,
      size: 18,
      font: helveticaBoldWrapped,
      color: primaryColor,
    });
    y -= 40;

    for (const row of normalizedProposal.technical_specs_table) {
      if (y < 150) {
        page = createPage();
        y = pageHeight - margin;
      }

      const cellWidth = 250;
      row.forEach((cell: string, idx: number) => {
        const x = margin + idx * cellWidth;
        page.drawRectangle({
          x,
          y: y - 30,
          width: cellWidth,
          height: 30,
          borderColor: rgb(0.9, 0.91, 0.92),
          borderWidth: 1,
        });

        const font = idx === 0 ? helveticaBold : helvetica;
        const color = idx === 0 ? primaryColor : textColor;

        safeDrawText(page,normalizeForWinAnsi((cell || '').substring(0, 35)), { x: x + 5, y: y - 18, size: 9, font, color });
      });

      y -= 30;
    }
  }

  for (const eq of normalizedEquipment) {
    const titleText = normalizeForWinAnsi(eq.equipment_name ?? 'Equipo');

    const startEquipmentPage = () => {
      page = createPage();
      y = pageHeight - margin - 40;
      safeDrawText(page,titleText, { x: margin, y, size: 16, font: helveticaBold, color: primaryColor });
      y -= 40;
    };

    const ensureEquipmentSpace = (neededHeight: number) => {
      if (y - neededHeight < margin) {
        startEquipmentPage();
      }
    };

    startEquipmentPage();

    if (eq.equipment_specs?.description) {
      // Normalizar la descripción del equipo, incluyendo HTML si existe
      const normalizedDesc = stripHTML(eq.equipment_specs.description);
      const descLines = normalizedDesc.split('\n');
      for (const rawLine of descLines) {
        const line = normalizeForWinAnsi(rawLine.trim());
        if (!line) {
          ensureEquipmentSpace(15);
          y -= 15;
          continue;
        }
        ensureEquipmentSpace(15);
        safeDrawText(page, line.substring(0, 90), { x: margin, y, size: 10, font: helvetica, color: textColor });
        y -= 15;
      }
      y -= 20;
    }

    const equipmentImagesRaw = Array.isArray(eq.equipment_specs?.images) ? eq.equipment_specs?.images ?? [] : [];
    const equipmentImages = equipmentImagesRaw
      .map((img: any) => {
        if (!img) return null;
        if (typeof img === 'string') {
          return { url: img, caption: null };
        }
        if (typeof img === 'object' && typeof img.image_url === 'string') {
          return { url: img.image_url, caption: typeof img.caption === 'string' ? img.caption : null };
        }
        return null;
      })
      .filter((img): img is { url: string; caption: string | null } => !!img && !!img.url);

    if (equipmentImages.length > 0) {
      const maxImageWidth = (pageWidth - margin * 2 - 20) / 2;
      const maxImageHeight = 180;
      const gap = 20;

      const drawImagesHeader = () => {
        ensureEquipmentSpace(20);
        safeDrawText(page,normalizeForWinAnsi('Imágenes'), { x: margin, y, size: 12, font: helveticaBold, color: textColor });
        y -= 25;
      };

      drawImagesHeader();

      let x = margin;
      let rowHeight = 0;

      for (const imgData of equipmentImages) {
        const pdfImage = await embedImageFromUrl(imgData.url);
        if (!pdfImage) continue;

        const scale = Math.min(maxImageWidth / pdfImage.width, maxImageHeight / pdfImage.height, 1);
        const imgWidth = pdfImage.width * scale;
        const imgHeight = pdfImage.height * scale;
        const captionHeight = imgData.caption ? 16 : 0;
        const blockHeight = imgHeight + captionHeight + 10;

        if (x + imgWidth > pageWidth - margin) {
          y -= rowHeight + gap;
          x = margin;
          rowHeight = 0;
        }

        if (y - blockHeight < margin) {
          startEquipmentPage();
          drawImagesHeader();
          x = margin;
          rowHeight = 0;
        }

        page.drawImage(pdfImage, {
          x,
          y: y - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });

        if (imgData.caption) {
          safeDrawText(page,normalizeForWinAnsi(imgData.caption.substring(0, 80)), {
            x,
            y: y - imgHeight - 12,
            size: 9,
            font: helveticaWrapped,
            color: mutedColor,
          });
        }

        rowHeight = Math.max(rowHeight, blockHeight);
        x += maxImageWidth + gap;
      }

      y -= rowHeight + 20;
    }

    if (eq.equipment_specs?.tables) {
      for (const table of eq.equipment_specs.tables) {
        ensureEquipmentSpace(60);
        safeDrawText(page,normalizeForWinAnsi(table.title), { x: margin, y, size: 12, font: helveticaBold, color: primaryColor });
        y -= 30;

        if (Array.isArray(table.table_data)) {
          for (const row of table.table_data) {
            if (y < margin + 80) {
              startEquipmentPage();
              safeDrawText(page,normalizeForWinAnsi(table.title), { x: margin, y, size: 12, font: helveticaBold, color: primaryColor });
              y -= 30;
            }

            const cellWidth = 250;
            // Normalize each cell to remove problematic characters
            const normalizedRow = row.map((cell: string) => normalizeForWinAnsi(String(cell || '')));
            normalizedRow.forEach((cell: string, idx: number) => {
              const x = margin + idx * cellWidth;
              page.drawRectangle({
                x,
                y: y - 25,
                width: cellWidth,
                height: 25,
                borderColor: rgb(0.9, 0.91, 0.92),
                borderWidth: 1,
              });

              safeDrawText(page,normalizeForWinAnsi((cell || '').substring(0, 35)), {
                x: x + 5,
                y: y - 16,
                size: 9,
                font: helveticaWrapped,
                color: textColor,
              });
            });

            y -= 25;
          }
        }

        y -= 20;
      }
    }
  }

  if (normalizedProposal.offer_details) {
    page = createPage();
    y = pageHeight - margin - 40;

    safeDrawText(page,normalizeForWinAnsi('Detalles de la Oferta'), { x: margin, y, size: 18, font: helveticaBold, color: primaryColor });
    y -= 40;

    const detailsText = stripHTML(normalizedProposal.offer_details);
    const detailsLines = detailsText.split('\n').slice(0, 30);
    for (const line of detailsLines) {
      if (y < 100) break;
      safeDrawText(page,normalizeForWinAnsi(line.substring(0, 80)), { x: margin, y, size: 10, font: helvetica, color: textColor });
      y -= 15;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p: any, i: number) => {
    addFooter(p, i + 1, pages.length);
  });
}

async function loadBackgroundImage(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const response = await fetch(backgroundImageUrl);
    console.log('[PDF] Fondo status:', response.status, response.statusText);
    if (!response.ok) {
      console.warn(`No se pudo descargar la imagen de fondo: ${backgroundImageUrl}`);
      return null;
    }
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    console.log('[PDF] Fondo content-type:', contentType, 'content-length:', contentLength);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch (jpgError) {
      console.warn('[PDF] No se pudo interpretar como JPG, intentando PNG:', jpgError);
      return await pdfDoc.embedPng(bytes);
    }
  } catch (error) {
    console.error(`Error cargando la imagen de fondo ${backgroundImageUrl}:`, error);
    return null;
  }
}
