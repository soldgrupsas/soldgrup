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

const primaryColor = rgb(0.15, 0.39, 0.92); // #2563eb
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
  const stripHTML = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
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

  page.drawText('PROPUESTA COMERCIAL', {
    x: pageWidth / 2 - 150,
    y: 550,
    size: 28,
    font: helveticaBold,
    color: primaryColor,
  });

  page.drawText(proposal.offer_id || 'N/A', {
    x: pageWidth / 2 - 60,
    y: 480,
    size: 20,
    font: helveticaBold,
    color: textColor,
  });

  page.drawText(proposal.client || 'Cliente', {
    x: pageWidth / 2 - 80,
    y: 430,
    size: 16,
    font: helvetica,
    color: mutedColor,
  });

  if (proposal.presentation_date) {
    const date = new Date(proposal.presentation_date);
    const dateStr = date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    page.drawText(dateStr, {
      x: pageWidth / 2 - 100,
      y: 390,
      size: 12,
      font: helvetica,
      color: mutedColor,
    });
  }

  // PAGE 2: Client Information
  page = createPage();
  let y = pageHeight - margin - 40;

  page.drawText('Información del Cliente', {
    x: margin,
    y: y,
    size: 18,
    font: helveticaBold,
    color: primaryColor,
  });
  y -= 40;

  if (proposal.client) {
    page.drawText('Cliente:', { x: margin, y, size: 10, font: helveticaBold, color: textColor });
    page.drawText(proposal.client, { x: 200, y, size: 10, font: helvetica, color: textColor });
    y -= 25;
  }

  if (proposal.contact_person) {
    page.drawText('Contacto:', { x: margin, y, size: 10, font: helveticaBold, color: textColor });
    page.drawText(proposal.contact_person, { x: 200, y, size: 10, font: helvetica, color: textColor });
    y -= 25;
  }

  if (proposal.reference) {
    page.drawText('Referencia:', { x: margin, y, size: 10, font: helveticaBold, color: textColor });
    y -= 15;
    const refText = stripHTML(proposal.reference);
    const refLines = refText.split('\n').slice(0, 5);
    for (const line of refLines) {
      page.drawText(line.substring(0, 80), { x: margin, y, size: 10, font: helvetica, color: textColor });
      y -= 15;
    }
    y -= 10;
  }

  y -= 20;
  page.drawText('Contacto Soldgrup', {
    x: margin,
    y: y,
    size: 14,
    font: helveticaBold,
    color: primaryColor,
  });
  y -= 30;

  if (proposal.soldgrup_contact) {
    const contactText = stripHTML(proposal.soldgrup_contact);
    const contactLines = contactText.split('\n').slice(0, 5);
    for (const line of contactLines) {
      page.drawText(line.substring(0, 80), { x: margin, y, size: 10, font: helvetica, color: textColor });
      y -= 15;
    }
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
      const desc = stripHTML(item.description ?? '').substring(0, 100);
      const rowHeight = 30;

      if (y - rowHeight < 100) {
        page = createPage();
        y = pageHeight - margin;
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

      page.drawText(desc, {
        x: startX + colWidths[0] + 5,
        y: y - 17,
        size: 8,
        font: helvetica,
        color: textColor,
        maxWidth: colWidths[1] - 10,
      });

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
    page = createPage();
    y = pageHeight - margin - 40;

    page.drawText(eq.equipment_name ?? 'Equipo', { x: margin, y, size: 16, font: helveticaBold, color: primaryColor });
    y -= 40;

    if (eq.equipment_specs?.description) {
      const descLines = eq.equipment_specs.description.split('\n').slice(0, 5);
      for (const line of descLines) {
        page.drawText(line.substring(0, 80), { x: margin, y, size: 10, font: helvetica, color: textColor });
        y -= 15;
      }
      y -= 20;
    }

    if (eq.equipment_specs?.tables) {
      for (const table of eq.equipment_specs.tables) {
        if (y < 200) {
          page = createPage();
          y = pageHeight - margin;
        }

        page.drawText(table.title, { x: margin, y, size: 12, font: helveticaBold, color: primaryColor });
        y -= 30;

        if (Array.isArray(table.table_data)) {
          for (const row of table.table_data.slice(0, 15)) {
            if (y < 150) break;

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
