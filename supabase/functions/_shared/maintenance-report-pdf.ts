import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'npm:pdf-lib@1.17.1';
// Local base64 decoder to avoid remote imports during cold start in Edge Functions
const base64Decode = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

type ChecklistStatus = 'good' | 'bad' | null;

type ChecklistEntry = {
  index: number;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type PhotoEntry = {
  url?: string; // legacy path - kept for backward compatibility
  bytes?: Uint8Array; // preferred: raw bytes provided by the caller
  contentType?: string | null;
  description?: string | null;
};

type MaintenanceTests = {
  voltage?: string;
  polipasto?: {
    subir?: { l1?: string; l2?: string; l3?: string };
    bajar?: { l1?: string; l2?: string; l3?: string };
  };
};

type BasicInfo = {
  company?: string | null;
  address?: string | null;
  phone?: string | null;
  contact?: string | null;
  technicianName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  equipment?: string | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  capacity?: string | null;
  locationPg?: string | null;
  voltage?: string | null;
};

export type MaintenanceReportPdfPayload = {
  title?: string;
  reportId: string;
  basicInfo: BasicInfo;
  initialState?: string | null;
  recommendations?: string | null;
  tests?: MaintenanceTests | null;
  checklist: ChecklistEntry[];
  photos: PhotoEntry[];
};

const margin = 50;
const pageWidth = 612; // Letter
const pageHeight = 792;
const contentWidth = pageWidth - margin * 2;

const headingColor = rgb(0, 0, 0);
const textColor = rgb(0.2, 0.2, 0.2);
const mutedColor = rgb(0.5, 0.5, 0.5);
const borderColor = rgb(0.7, 0.7, 0.7);

const checklistItems = [
  'Motor de elevación',
  'Freno motor de elevación',
  'Trolley',
  'Motor trolley',
  'Freno motor trolley',
  'Guías de trolley',
  'Ruedas trolley',
  'Monorriel',
  'Gancho',
  'Cadena',
  'Gabinete eléctrico',
  'Aceite',
  'Estructura y aparellaje',
  'Topes mecánicos',
  'Botonera',
  'Pines de seguridad',
  'Polipasto',
  'Límite de elevación',
  'Carro porta escobillas',
  'Carros intermedios y cables planos',
  'Carcazas',
];

const SOLDGRUP_LOGO_BASE64 =
  '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';

export async function createMaintenanceReportPDF(payload: MaintenanceReportPdfPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  try {
    const logoBytes = base64Decode(SOLDGRUP_LOGO_BASE64);
    logoImage = await pdfDoc.embedPng(logoBytes);
  } catch (error) {
    console.warn('No se pudo cargar el logo de Soldgrup para el PDF', error);
  }

  const embeddedPhotos: { image: PDFImage; description?: string | null; width: number; height: number }[] = [];

  for (const photo of payload.photos) {
    try {
      let bytes: Uint8Array | null = null;
      let contentType = photo.contentType ?? '';

      if (photo.bytes && photo.bytes.length) {
        bytes = photo.bytes;
      } else if (photo.url) {
        const response = await fetch(photo.url);
        if (!response.ok) {
          console.warn('No se pudo descargar la foto:', photo.url);
          continue;
        }
        contentType = response.headers.get('content-type') ?? contentType ?? '';
        const arrayBuffer = await response.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } else {
        continue;
      }
      // Omitir imágenes demasiado grandes para evitar OOM
      if (bytes.length > 2_500_000) {
        console.warn('Foto omitida por tamaño (bytes):', photo.url, bytes.length);
        continue;
      }

      let pdfImage: PDFImage | null = null;
      if (contentType.includes('png') || (photo.url?.toLowerCase().endsWith('.png'))) {
        pdfImage = await pdfDoc.embedPng(bytes);
      } else if (contentType.includes('jpeg') || contentType.includes('jpg') || (photo.url?.toLowerCase().match(/\.jpe?g$/))) {
        pdfImage = await pdfDoc.embedJpg(bytes);
      } else if (contentType.includes('webp') || (photo.url?.toLowerCase().endsWith('.webp'))) {
        // WEBP no soportado nativamente por pdf-lib en Deno sin dependencias extra
        console.warn('Formato WEBP detectado; se omite o se recomienda convertir a JPEG');
      } else {
        // Intento genérico: probar JPEG primero, luego PNG
        try {
          pdfImage = await pdfDoc.embedJpg(bytes);
        } catch {
          try {
            pdfImage = await pdfDoc.embedPng(bytes);
          } catch (error) {
            console.warn('Formato de imagen no soportado:', photo.url, error);
          }
        }
      }

      if (pdfImage) {
        embeddedPhotos.push({
          image: pdfImage,
          description: photo.description,
          width: pdfImage.width,
          height: pdfImage.height,
        });
      }
    } catch (error) {
      console.error('Error procesando fotografía', photo.url, error);
    }
  }

  let isFirstPage = true;
  const addPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const cursorStart = drawHeader(page, fontBold, {
      title: payload.title ?? 'Informe de Mantenimiento',
      showTitle: isFirstPage,
      logo: isFirstPage ? logoImage : null,
    });
    isFirstPage = false;
    return { page, cursorY: cursorStart };
  };

  let current = addPage();

  const ensureSpace = (height: number) => {
    if (current.cursorY - height < margin + 40) {
      current = addPage();
    }
  };

  const drawSectionTitle = (title: string) => {
    const size = 14;
    ensureSpace(size + 16);
    current.page.drawText(title, { x: margin, y: current.cursorY - size, size, font: fontBold, color: headingColor });
    current.cursorY -= size + 8;
    current.page.drawLine({
      start: { x: margin, y: current.cursorY - 4 },
      end: { x: pageWidth - margin, y: current.cursorY - 4 },
      color: borderColor,
      thickness: 1,
    });
    current.cursorY -= 16;
  };

  const drawKeyValueGrid = (pairs: { label: string; value?: string | null }[]) => {
    const filtered = pairs.filter((pair) => pair.value && pair.value.toString().trim().length > 0);
    if (filtered.length === 0) return;
    const columnWidth = (contentWidth - 20) / 2;
    const lineHeight = 14;

    for (let i = 0; i < filtered.length; i += 2) {
      const left = filtered[i];
      const right = filtered[i + 1];

      const leftLines = wrapText(`${left.label}: ${left.value}`, fontRegular, 11, columnWidth);
      const rightLines = right ? wrapText(`${right.label}: ${right.value}`, fontRegular, 11, columnWidth) : [];
      const rows = Math.max(leftLines.length, rightLines.length);
      const blockHeight = rows * lineHeight + 4;
      ensureSpace(blockHeight);

      drawWrappedText(current.page, leftLines, { x: margin, y: current.cursorY, font: fontRegular, size: 11, color: textColor, lineHeight });
      if (right) {
        drawWrappedText(current.page, rightLines, { x: margin + columnWidth + 20, y: current.cursorY, font: fontRegular, size: 11, color: textColor, lineHeight });
      }

      current.cursorY -= blockHeight;
    }

    current.cursorY -= 6;
  };

  const drawParagraph = (text: string | null | undefined) => {
    if (!text?.trim()) return;
    const lines = wrapText(text.trim(), fontRegular, 11, contentWidth);
    const height = lines.length * 14 + 8;
    ensureSpace(height);
    drawWrappedText(current.page, lines, { x: margin, y: current.cursorY, font: fontRegular, size: 11, color: textColor, lineHeight: 14 });
    current.cursorY -= height;
  };

  const drawTableRow = (values: string[], colWidths: number[], lineHeight: number, isHeader: boolean) => {
    const textSize = isHeader ? 11 : 10;
    const textFont = isHeader ? fontBold : fontRegular;
    const paddingY = 8;
    const paddingX = 6;

    const lineSets = values.map((value, index) => {
      const width = colWidths[index] - paddingX * 2;
      if (index === 2 || index === 3) {
        return value ? [value] : [''];
      }
      return wrapText(value ?? '', textFont, textSize, Math.max(width, 4));
    });

    const linesCount = Math.max(...lineSets.map((lines) => lines.length || 1));
    const rowHeight = Math.max(linesCount * lineHeight + paddingY, lineHeight + paddingY);
    ensureSpace(rowHeight + 2);

    current.page.drawRectangle({
      x: margin,
      y: current.cursorY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: isHeader ? rgb(0.94, 0.94, 0.94) : undefined,
      borderColor,
      borderWidth: 0.8,
    });

    let xPointer = margin;
    values.forEach((value, index) => {
      const width = colWidths[index];
      current.page.drawLine({
        start: { x: xPointer, y: current.cursorY },
        end: { x: xPointer, y: current.cursorY - rowHeight },
        color: borderColor,
        thickness: 0.8,
      });
      const lines = lineSets[index];
      if (index === values.length - 1) {
        current.page.drawLine({
          start: { x: xPointer + width, y: current.cursorY },
          end: { x: xPointer + width, y: current.cursorY - rowHeight },
          color: borderColor,
          thickness: 0.8,
        });
      }

      if (index === 0 || index === 2 || index === 3) {
        const text = (value ?? '').toString();
        const textWidth = textFont.widthOfTextAtSize(text, textSize);
        const textX = xPointer + width / 2 - textWidth / 2;
        const textY = current.cursorY - rowHeight / 2 - textSize / 2 + 2;
        if (text.trim()) {
          current.page.drawText(text, {
            x: textX,
            y: textY,
            font: textFont,
            size: textSize,
            color: isHeader ? headingColor : textColor,
          });
        }
      } else {
        drawWrappedText(current.page, lines, {
          x: xPointer + paddingX,
          y: current.cursorY - paddingY,
          font: textFont,
          size: textSize,
          color: isHeader ? headingColor : textColor,
          lineHeight,
        });
      }

      xPointer += width;
    });

    current.cursorY -= rowHeight;
  };

  const drawTests = (tests?: MaintenanceTests | null) => {
    if (!tests) return;
    const rows: string[][] = [];
    if (tests.voltage) {
      rows.push(['Voltaje', tests.voltage, '', '']);
    }
    const subir = tests.polipasto?.subir;
    const bajar = tests.polipasto?.bajar;
    const hasSubir = Boolean(subir?.l1 || subir?.l2 || subir?.l3);
    const hasBajar = Boolean(bajar?.l1 || bajar?.l2 || bajar?.l3);
    if (hasSubir) {
      rows.push(['Polipasto - SUBIR', subir?.l1 ?? '', subir?.l2 ?? '', subir?.l3 ?? '']);
    }
    if (hasBajar) {
      rows.push(['Polipasto - BAJAR', bajar?.l1 ?? '', bajar?.l2 ?? '', bajar?.l3 ?? '']);
    }
    if (!rows.length) return;

    const colWidths = [contentWidth * 0.4, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2];
    const lineHeight = 14;

    ensureSpace(24);
    drawTableRow(['Prueba', 'L1 / Valor 1', 'L2 / Valor 2', 'L3 / Valor 3'], colWidths, lineHeight, true);
    for (const row of rows) {
      drawTableRow(row, colWidths, lineHeight, false);
    }
    current.cursorY -= 12;
  };

  const drawChecklist = (entries: ChecklistEntry[]) => {
    drawSectionTitle('Lista de chequeo');
    const numberWidth = 40;
    const goodWidth = 60;
    const badWidth = 60;
    const observationWidth = contentWidth * 0.5;
    const descriptionWidth = contentWidth - numberWidth - goodWidth - badWidth - observationWidth;
    const colWidths = [numberWidth, descriptionWidth, goodWidth, badWidth, observationWidth];
    const lineHeight = 14;

    drawTableRow(['#', 'Ítem', 'Buen estado', 'Mal estado', 'Observaciones'], colWidths, lineHeight, true);

    entries.forEach((entry, idx) => {
      const values = [
        String(entry.index + 1),
        entry.name,
        entry.status === 'good' ? 'X' : '',
        entry.status === 'bad' ? 'X' : '',
        entry.observation ?? '',
      ];
      drawTableRow(values, colWidths, lineHeight, false);
    });
    current.cursorY -= 16;
  };

  const drawPhotos = () => {
    if (!embeddedPhotos.length) return;
    drawSectionTitle('Registro fotográfico');
    const maxImageWidth = contentWidth;
    const maxImageHeight = 220;

    for (const photo of embeddedPhotos) {
      const scale = Math.min(maxImageWidth / photo.width, maxImageHeight / photo.height, 1);
      const drawWidth = photo.width * scale;
      const drawHeight = photo.height * scale;
      const requiredHeight = drawHeight + (photo.description ? 42 : 20);
      ensureSpace(requiredHeight);

      current.page.drawImage(photo.image, {
        x: margin + (contentWidth - drawWidth) / 2,
        y: current.cursorY - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });
      current.cursorY -= drawHeight + 12;

      if (photo.description) {
        const lines = wrapText(photo.description, fontRegular, 11, contentWidth);
        drawWrappedText(current.page, lines, {
          x: margin,
          y: current.cursorY,
          font: fontRegular,
          size: 11,
          color: mutedColor,
          lineHeight: 14,
        });
        current.cursorY -= lines.length * 14 + 12;
      } else {
        current.cursorY -= 8;
      }
    }
  };

  // Información Básica
  drawSectionTitle('Información general');
  drawKeyValueGrid([
    { label: 'Empresa', value: payload.basicInfo.company },
    { label: 'Contacto', value: payload.basicInfo.contact },
    { label: 'Dirección', value: payload.basicInfo.address },
    { label: 'Teléfono', value: payload.basicInfo.phone },
    { label: 'Técnico responsable', value: payload.basicInfo.technicianName },
    { label: 'Equipo', value: payload.basicInfo.equipment },
    { label: 'Marca', value: payload.basicInfo.brand },
    { label: 'Modelo', value: payload.basicInfo.model },
    { label: 'Serie', value: payload.basicInfo.serial },
    { label: 'Capacidad', value: payload.basicInfo.capacity },
    { label: 'Ubicación PG', value: payload.basicInfo.locationPg },
    { label: 'Voltaje', value: payload.basicInfo.voltage },
    { label: 'Fecha de inicio', value: formatDate(payload.basicInfo.startDate) },
    { label: 'Fecha final', value: formatDate(payload.basicInfo.endDate) },
  ]);

  drawSectionTitle('Estado inicial del equipo');
  drawParagraph(payload.initialState);

  drawChecklist(normalizeChecklist(payload.checklist));

  drawSectionTitle('Recomendaciones');
  drawParagraph(payload.recommendations);

  drawSectionTitle('Pruebas sin carga');
  drawTests(payload.tests ?? null);

  drawPhotos();

  return await pdfDoc.save();
}

function drawHeader(
  page: any,
  font: any,
  {
    title,
    showTitle,
    logo,
  }: {
    title: string;
    showTitle: boolean;
    logo: PDFImage | null;
  },
) {
  const top = pageHeight - margin;
  let headerBottom = top;

  if (logo) {
    const maxWidth = 150;
    const maxHeight = 60;
    const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
    const drawWidth = logo.width * scale;
    const drawHeight = logo.height * scale;
    const x = margin;
    const y = top - drawHeight;
    page.drawImage(logo, { x, y, width: drawWidth, height: drawHeight });
    headerBottom = Math.min(headerBottom, y);
  }

  if (showTitle && title) {
    const size = 18;
    const titleWidth = font.widthOfTextAtSize(title, size);
    const x = pageWidth - margin - titleWidth;
    const y = top - size + 4;
    page.drawText(title, { x, y, size, font, color: headingColor });
    headerBottom = Math.min(headerBottom, y - 8);
  }

  const lineY = headerBottom - 12;
  page.drawLine({
    start: { x: margin, y: lineY },
    end: { x: pageWidth - margin, y: lineY },
    color: borderColor,
    thickness: 1,
  });

  return lineY - 16;
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const newLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(newLine, size);
    if (width <= maxWidth) {
      currentLine = newLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

function drawWrappedText(
  page: any,
  lines: string[],
  {
    x,
    y,
    font,
    size,
    color,
    lineHeight,
  }: { x: number; y: number; font: any; size: number; color: any; lineHeight: number },
) {
  let offsetY = 0;
  for (const line of lines) {
    page.drawText(line, { x, y: y - offsetY, font, size, color });
    offsetY += lineHeight;
  }
}

function normalizeChecklist(entries: ChecklistEntry[]): ChecklistEntry[] {
  const byName = new Map(entries.map((entry) => [entry.name.trim().toLowerCase(), entry]));
  return checklistItems.map((name, index) => {
    const entry = byName.get(name.trim().toLowerCase());
    return {
      index,
      name,
      status: entry?.status ?? null,
      observation: entry?.observation ?? '',
    };
  });
}

function formatDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
