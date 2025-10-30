import { createClient } from 'jsr:@supabase/supabase-js@2';
import jsPDF from 'https://cdn.skypack.dev/jspdf@2.5.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔵 generate-proposal-pdf: Iniciando generación de PDF');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { proposalId } = await req.json();

    if (!proposalId) {
      throw new Error('proposalId es requerido');
    }

    console.log(`📄 Consultando propuesta: ${proposalId}`);

    // Fetch proposal data
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (proposalError) throw proposalError;

    // Fetch related data
    const [{ data: items }, { data: images }, { data: equipment }] = await Promise.all([
      supabase.from('proposal_items').select('*').eq('proposal_id', proposalId).order('item_number'),
      supabase.from('proposal_images').select('*').eq('proposal_id', proposalId).order('image_order'),
      supabase.from('equipment_details').select('*').eq('proposal_id', proposalId),
    ]);

    console.log('✅ Datos consultados correctamente');

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const primaryColor = rgb(0.15, 0.39, 0.92); // #2563eb
    const textColor = rgb(0.12, 0.16, 0.22); // #1f2937
    const mutedColor = rgb(0.42, 0.45, 0.50); // #6b7280

    await generatePDFContent(
      pdfDoc,
      helvetica,
      helveticaBold,
      primaryColor,
      textColor,
      mutedColor,
      proposal,
      items || [],
      equipment || []
    );

    const pdfBytes = await pdfDoc.save();

    console.log('✅ PDF generado exitosamente');

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Propuesta_${proposal.offer_id}_${proposal.client}.pdf"`,
      },
    });
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generatePDFContent(
  pdfDoc: any,
  helvetica: any,
  helveticaBold: any,
  primaryColor: any,
  textColor: any,
  mutedColor: any,
  proposal: any,
  items: any[],
  equipment: any[]
) {
  const margin = 72; // 2.5cm
  const pageWidth = 612; // Letter size
  const pageHeight = 792;

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
  let page = pdfDoc.addPage([pageWidth, pageHeight]);

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
  page = pdfDoc.addPage([pageWidth, pageHeight]);
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
    const refLines = refText.split('\n').slice(0, 5); // Limit lines
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
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 40;

    page.drawText('OFERTA COMERCIAL', {
      x: margin,
      y: y,
      size: 18,
      font: helveticaBold,
      color: primaryColor,
    });
    y -= 40;

    // Table header
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

    // Table rows
    for (const item of items) {
      const desc = stripHTML(item.description).substring(0, 100);
      const rowHeight = 30;

      if (y - rowHeight < 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      // Draw borders
      page.drawRectangle({
        x: startX,
        y: y - rowHeight,
        width: colWidths[0],
        height: rowHeight,
        borderColor: rgb(0.9, 0.91, 0.92),
        borderWidth: 1,
      });

      page.drawText(item.item_number.toString(), {
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

      page.drawText(`${item.quantity} ${item.unit}`, {
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

      page.drawText(`$${Number(item.unit_price).toLocaleString('es-CO')}`, {
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

      page.drawText(`$${Number(item.total_price).toLocaleString('es-CO')}`, {
        x: startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5,
        y: y - 17,
        size: 9,
        font: helvetica,
        color: textColor,
      });

      y -= rowHeight;
    }

    // Total
    const total = items.reduce((sum, item) => sum + Number(item.total_price), 0);
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

  // Observations
  if (proposal.observations) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
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

  // Technical Specifications
  if (proposal.technical_specs_table && proposal.technical_specs_table.length > 0) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
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
        page = pdfDoc.addPage([pageWidth, pageHeight]);
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

  // Equipment
  for (const eq of equipment) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 40;

    page.drawText(eq.equipment_name, { x: margin, y, size: 16, font: helveticaBold, color: primaryColor });
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
          page = pdfDoc.addPage([pageWidth, pageHeight]);
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

  // Offer Details
  if (proposal.offer_details) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
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

  // Add footers to all pages
  const pages = pdfDoc.getPages();
  pages.forEach((p: any, i: number) => {
    addFooter(p, i + 1, pages.length);
  });
}
