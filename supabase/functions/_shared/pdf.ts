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

export async function createProposalPDF({
  proposal,
  items,
  equipment,
  images,
}: CreateProposalPDFParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const embeddedImages = await loadProposalImages(pdfDoc, images);
  const backgroundImage = await loadBackgroundImage(pdfDoc);

  await generatePDFContent({
    pdfDoc,
    helvetica,
    helveticaBold,
    proposal,
    items,
    equipment,
    images: embeddedImages,
    backgroundImage,
  });

  const pdfBytes = await pdfDoc.save();
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
        caption: image.image_caption,
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
  const arial = helvetica;
  const arialBold = helveticaBold;
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

  const stripHTML = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  };

  const wrapText = (text: string, font: any, size: number, maxWidth: number) => {
    const sanitized = text.replace(/\s+/g, ' ').trim();
    if (!sanitized) return [];

    const words = sanitized.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const candidateWidth = font.widthOfTextAtSize(candidate, size);

      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      let splitWord = word;
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

    const rawLines = text.split('\n');
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
      const words = line.split(' ');
      if (words.length <= 1) {
        page.drawText(line, { x, y: baselineY, size, font, color });
        return;
      }

      const wordsWidth = words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0);
      const extraSpace = maxWidth - wordsWidth;
      if (extraSpace <= 0) {
        page.drawText(line, { x, y: baselineY, size, font, color });
        return;
      }

      const gapWidth = extraSpace / (words.length - 1);
      let cursorX = x;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        page.drawText(word, { x: cursorX, y: baselineY, size, font, color });
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
      const textWidth = font.widthOfTextAtSize(line, size);

      if (alignment === 'right') {
        const offsetX = x + Math.max(0, maxWidth - textWidth);
        page.drawText(line, { x: offsetX, y: remainingY, size, font, color });
      } else if (alignment === 'center') {
        const offsetX = x + Math.max(0, (maxWidth - textWidth) / 2);
        page.drawText(line, { x: offsetX, y: remainingY, size, font, color });
      } else if (alignment === 'justify' && !isLastLine) {
        drawJustifiedLine(line, remainingY);
      } else {
        page.drawText(line, { x, y: remainingY, size, font, color });
      }

      remainingY -= actualLineHeight;
    });

    return remainingY;
  };

  const addFooter = (page: any, pageNum: number, totalPages: number) => {
    page.drawText('Soldgrup - La fuerza de su industria | www.soldgrup.com', {
      x: margin,
      y: 40,
      size: 8,
      font: helvetica,
      color: mutedColor,
    });
    page.drawText(`Página ${pageNum} de ${totalPages}`, {
      x: pageWidth / 2 - 30,
      y: 25,
      size: 8,
      font: helvetica,
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

  const createPage = () => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawBackground(page);
    return page;
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

  const proposalId = proposal.offer_id || 'N/A';
  const proposalIdWidth = arialBold.widthOfTextAtSize(proposalId, baseSize);
  page.drawText(proposalId, {
    x: pageWidth - margin - proposalIdWidth,
    y,
    size: baseSize,
    font: arialBold,
    color: black,
  });
  y -= lineHeight;

  const date = proposal.presentation_date ? new Date(proposal.presentation_date) : null;
  const dateStr = date
    ? date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const cityLine = dateStr ? `Pereira, ${dateStr}` : 'Pereira,';
  page.drawText(cityLine, {
    x: margin,
    y,
    size: baseSize,
    font: arial,
    color: black,
  });
  y -= lineHeight;

  addBlankLines(4);

  page.drawText('Señores.', {
    x: margin,
    y,
    size: baseSize,
    font: arial,
    color: black,
  });
  y -= lineHeight;

  const clientName = proposal.client || '';
  if (clientName) {
    page.drawText(clientName, {
      x: margin,
      y,
      size: baseSize,
      font: arial,
      color: black,
    });
    y -= lineHeight;
  }

  addBlankLines(4);

  const referenceText = stripHTML(proposal.reference ?? '');
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
    page.drawText('Referencia:', {
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

  page.drawText('Cordialmente,', {
    x: margin,
    y,
    size: baseSize,
    font: arial,
    color: black,
  });
  y -= lineHeight;

  addBlankLines(3);

  const soldgrupContact = stripHTML(proposal.soldgrup_contact ?? '');
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
  if (items.length > 0) {
    page = createPage();
    y = pageHeight - margin - 40;

    page.drawText('OFERTA COMERCIAL', {
      x: margin,
      y: y,
      size: 18,
      font: helveticaBold,
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

    page.drawText('Item', { x: startX + 5, y: y - 17, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('Descripción', {
      x: startX + colWidths[0] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Cant.', {
      x: startX + colWidths[0] + colWidths[1] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    page.drawText('P. Unit.', {
      x: startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    page.drawText('P. Total', {
      x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
      y: y - 17,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    y -= headerHeight;

    for (const item of items) {
      const desc = stripHTML(item.description ?? '');
      const descriptionLines = wrapText(desc, helvetica, 8, colWidths[1] - 10);
      const rowHeight = Math.max(30, descriptionLines.length * 12 + 8);

      if (y - rowHeight < 100) {
        page = createPage();
        y = pageHeight - margin;
        page.drawText('OFERTA COMERCIAL', {
          x: margin,
          y: y,
          size: 18,
          font: helveticaBold,
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

        page.drawText('Item', { x: startX + 5, y: y - 17, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
        page.drawText('Descripción', {
          x: startX + colWidths[0] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
        page.drawText('Cant.', {
          x: startX + colWidths[0] + colWidths[1] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
        page.drawText('P. Unit.', {
          x: startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });
        page.drawText('P. Total', {
          x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
          y: y - 17,
          size: 10,
          font: helveticaBold,
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

      page.drawText(String(item.item_number ?? ''), {
        x: startX + 5,
        y: y - 17,
        size: 9,
        font: helvetica,
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
        page.drawText(line, {
          x: startX + colWidths[0] + 5,
          y: descriptionY,
          size: 8,
          font: helvetica,
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

      page.drawText(`${item.quantity ?? ''} ${item.unit ?? ''}`.trim(), {
        x: startX + colWidths[0] + colWidths[1] + 5,
        y: y - 17,
        size: 9,
        font: helvetica,
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

      page.drawText(`$${Number(item.unit_price ?? 0).toLocaleString('es-CO')}`, {
        x: startX + colWidths[0] + colWidths[1] + colWidths[2] + 5,
        y: y - 17,
        size: 9,
        font: helvetica,
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

      page.drawText(`$${Number(item.total_price ?? 0).toLocaleString('es-CO')}`, {
        x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
        y: y - 17,
        size: 9,
        font: helvetica,
        color: textColor,
      });

      y -= rowHeight;
    }

    const total = items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);
    y -= 20;

    page.drawText('Valor total Antes de IVA:', {
      x: startX + 250,
      y,
      size: 11,
      font: helveticaBold,
      color: textColor,
    });
    page.drawText(`$${total.toLocaleString('es-CO')}`, {
      x: startX + 410,
      y,
      size: 12,
      font: helveticaBold,
      color: primaryColor,
    });
  }

  if (proposal.observations) {
    page = createPage();
    y = pageHeight - margin - 40;

    page.drawText('Observaciones', { x: margin, y, size: 18, font: helveticaBold, color: primaryColor });
    y -= 40;

    const obsText = stripHTML(proposal.observations);
    const obsLines = obsText.split('\n').slice(0, 30);
    for (const line of obsLines) {
      if (y < 100) break;
      page.drawText(line.substring(0, 80), { x: margin, y, size: 10, font: helvetica, color: textColor });
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
      page.drawText('Galería de Imágenes', {
        x: margin,
        y,
        size: 18,
        font: helveticaBold,
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
        page.drawText(embeddedImage.caption.substring(0, 80), {
          x,
          y: y - imgHeight - 12,
          size: 9,
          font: helvetica,
          color: mutedColor,
        });
      }

      x += maxImageWidth + gap;
    }
  }

  if (proposal.technical_specs_table && proposal.technical_specs_table.length > 0) {
    page = createPage();
    y = pageHeight - margin - 40;

    page.drawText('Especificaciones Técnicas', {
      x: margin,
      y,
      size: 18,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 40;

    for (const row of proposal.technical_specs_table) {
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

        page.drawText((cell || '').substring(0, 35), { x: x + 5, y: y - 18, size: 9, font, color });
      });

      y -= 30;
    }
  }

  for (const eq of equipment) {
    const titleText = eq.equipment_name ?? 'Equipo';

    const startEquipmentPage = () => {
      page = createPage();
      y = pageHeight - margin - 40;
      page.drawText(titleText, { x: margin, y, size: 16, font: helveticaBold, color: primaryColor });
      y -= 40;
    };

    const ensureEquipmentSpace = (neededHeight: number) => {
      if (y - neededHeight < margin) {
        startEquipmentPage();
      }
    };

    startEquipmentPage();

    if (eq.equipment_specs?.description) {
      const descLines = eq.equipment_specs.description.split('\n');
      for (const rawLine of descLines) {
        const line = rawLine.trim();
        if (!line) {
          ensureEquipmentSpace(15);
          y -= 15;
          continue;
        }
        ensureEquipmentSpace(15);
        page.drawText(line.substring(0, 90), { x: margin, y, size: 10, font: helvetica, color: textColor });
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
        page.drawText('Imágenes', { x: margin, y, size: 12, font: helveticaBold, color: textColor });
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
          page.drawText(imgData.caption.substring(0, 80), {
            x,
            y: y - imgHeight - 12,
            size: 9,
            font: helvetica,
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
        page.drawText(table.title, { x: margin, y, size: 12, font: helveticaBold, color: primaryColor });
        y -= 30;

        if (Array.isArray(table.table_data)) {
          for (const row of table.table_data) {
            if (y < margin + 80) {
              startEquipmentPage();
              page.drawText(table.title, { x: margin, y, size: 12, font: helveticaBold, color: primaryColor });
              y -= 30;
            }

            const cellWidth = 250;
            row.forEach((cell: string, idx: number) => {
              const x = margin + idx * cellWidth;
              page.drawRectangle({
                x,
                y: y - 25,
                width: cellWidth,
                height: 25,
                borderColor: rgb(0.9, 0.91, 0.92),
                borderWidth: 1,
              });

              page.drawText((cell || '').substring(0, 35), {
                x: x + 5,
                y: y - 16,
                size: 9,
                font: helvetica,
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

  if (proposal.offer_details) {
    page = createPage();
    y = pageHeight - margin - 40;

    page.drawText('Detalles de la Oferta', { x: margin, y, size: 18, font: helveticaBold, color: primaryColor });
    y -= 40;

    const detailsText = stripHTML(proposal.offer_details);
    const detailsLines = detailsText.split('\n').slice(0, 30);
    for (const line of detailsLines) {
      if (y < 100) break;
      page.drawText(line.substring(0, 80), { x: margin, y, size: 10, font: helvetica, color: textColor });
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
