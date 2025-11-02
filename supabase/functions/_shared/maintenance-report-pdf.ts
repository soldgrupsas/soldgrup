import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'npm:pdf-lib@1.17.1';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

type ChecklistStatus = 'good' | 'bad' | null;

type ChecklistEntry = {
  index: number;
  name: string;
  status: ChecklistStatus;
  observation: string;
};

type PhotoEntry = {
  url: string;
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

export async function createMaintenanceReportPDF(payload: MaintenanceReportPdfPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const embeddedPhotos: { image: PDFImage; description?: string | null; width: number; height: number }[] = [];

  for (const photo of payload.photos) {
    try {
      if (!photo.url) continue;
      const response = await fetch(photo.url);
      if (!response.ok) {
        console.warn('No se pudo descargar la foto:', photo.url);
        continue;
      }
      const contentType = response.headers.get('content-type') ?? '';
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let pdfImage: PDFImage | null = null;
      if (contentType.includes('png') || photo.url.toLowerCase().endsWith('.png')) {
        pdfImage = await pdfDoc.embedPng(bytes);
      } else if (contentType.includes('jpeg') || contentType.includes('jpg') || photo.url.toLowerCase().match(/\.jpe?g$/)) {
        pdfImage = await pdfDoc.embedJpg(bytes);
      } else if (contentType.includes('webp') || photo.url.toLowerCase().endsWith('.webp')) {
        try {
          const image = await Image.decode(bytes);
          const png = image.encodePNG();
          pdfImage = await pdfDoc.embedPng(png);
        } catch (err) {
          console.warn('No se pudo convertir WEBP, se omite la foto:', photo.url, err);
        }
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

  const addPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawHeader(page, fontBold, payload.title ?? 'Informe de Mantenimiento', payload.reportId);
    return { page, cursorY: pageHeight - margin };
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

function drawHeader(page: any, font: any, title: string, reportId: string) {
  const size = 18;
  const subtitleSize = 11;
  page.drawText(title, { x: margin, y: pageHeight - margin - size, size, font, color: headingColor });
  page.drawText(`Código de informe: ${reportId}`, {
    x: margin,
    y: pageHeight - margin - size - subtitleSize - 4,
    size: subtitleSize,
    font,
    color: mutedColor,
  });
  page.drawLine({
    start: { x: margin, y: pageHeight - margin - size - subtitleSize - 12 },
    end: { x: pageWidth - margin, y: pageHeight - margin - size - subtitleSize - 12 },
    color: borderColor,
    thickness: 1,
  });
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
