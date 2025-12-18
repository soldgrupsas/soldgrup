import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createProposalPDF } from '../_shared/pdf.ts';
import { buildPdfResponseHeaders } from '../_shared/response.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔵 generate-proposal-pdf-public: Iniciando generación de PDF público');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { slug } = await req.json();

    if (!slug) {
      throw new Error('slug es requerido');
    }

    console.log(`📄 Consultando propuesta pública: ${slug}`);

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('public_url_slug', slug)
      .single();

    if (proposalError) throw proposalError;

    const [{ data: items }, { data: images }, { data: equipmentDetails }] = await Promise.all([
      supabase.from('proposal_items').select('*').eq('proposal_id', proposal.id).order('item_number'),
      supabase.from('proposal_images').select('*').eq('proposal_id', proposal.id).order('image_order'),
      supabase.from('equipment_details').select('*').eq('proposal_id', proposal.id),
    ]);

    // Load equipment dynamically from equipment table
    let equipment: any[] = [];
    if (equipmentDetails && equipmentDetails.length > 0) {
      const equipmentIds = equipmentDetails
        .map((eq: any) => eq.equipment_id || eq.equipment_specs?.id)
        .filter((id: string | null | undefined) => id);

      if (equipmentIds.length > 0) {
        // Fetch current equipment data from equipment table
        const { data: equipmentData } = await supabase
          .from('equipment')
          .select('id, name, description')
          .in('id', equipmentIds);

        // Fetch images and tables for each equipment
        equipment = await Promise.all(
          (equipmentData || []).map(async (eq) => {
            const [imagesResult, tablesResult] = await Promise.all([
              supabase
                .from('equipment_images')
                .select('image_url, image_order')
                .eq('equipment_id', eq.id)
                .order('image_order'),
              supabase
                .from('equipment_tables')
                .select('title, table_data, table_order')
                .eq('equipment_id', eq.id)
                .order('table_order'),
            ]);

            // Normalizar description del equipo actual para eliminar caracteres problemáticos
            let normalizedDescription = '';
            if (eq.description) {
              normalizedDescription = String(eq.description)
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Eliminar emojis
                .replace(/[\uD800-\uDFFF]/g, '') // Eliminar surrogates
                .replace(/\u2713/g, 'v')  // CHECK MARK -> v
                .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
                .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
                .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
                .replace(/\u221A/g, 'sqrt') // SQUARE ROOT -> sqrt
                .replace(/√/g, 'sqrt') // Símbolo raíz cuadrada directo
                .replace(/[^\x00-\x7F\xA0-\xFF]/g, '') // Eliminar todo fuera de ASCII y Latin-1
                .replace(/[\x81\x8D\x8F\x90\x9D]/g, ''); // Eliminar controles problemáticos
            }
            
            // Normalize table data to remove problematic characters
            const normalizeTableData = (tableData: any): any => {
              if (!Array.isArray(tableData)) return [];
              return tableData.map((row: any) => {
                if (!Array.isArray(row)) return [];
                return row.map((cell: any) => {
                  const cellStr = String(cell || '');
                  return cellStr
                    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Eliminar emojis
                    .replace(/[\uD800-\uDFFF]/g, '') // Eliminar surrogates
                    .replace(/\u2713/g, 'v')  // CHECK MARK -> v
                    .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
                    .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
                    .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
                    .replace(/\u221A/g, 'sqrt') // SQUARE ROOT -> sqrt
                    .replace(/√/g, 'sqrt') // Símbolo raíz cuadrada directo
                    .replace(/[^\x00-\x7F\xA0-\xFF]/g, '') // Eliminar todo fuera de ASCII y Latin-1
                    .replace(/[\x81\x8D\x8F\x90\x9D]/g, ''); // Eliminar controles problemáticos
                });
              });
            };
            
            return {
              equipment_name: eq.name || '',
              equipment_specs: {
                description: normalizedDescription,
                images: (imagesResult.data || []).map((img: any) => ({
                  image_url: img.image_url,
                  image_order: img.image_order,
                })),
                tables: (tablesResult.data || []).map((tbl: any) => ({
                  title: tbl.title ? String(tbl.title)
                    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
                    .replace(/[\uD800-\uDFFF]/g, '')
                    .replace(/\u2713/g, 'v')
                    .replace(/\u2714/g, 'v')
                    .replace(/\u2705/g, 'v')
                    .replace(/\u2611/g, 'v')
                    .replace(/\u221A/g, 'sqrt')
                    .replace(/√/g, 'sqrt')
                    .replace(/[^\x00-\x7F\xA0-\xFF]/g, '')
                    .replace(/[\x81\x8D\x8F\x90\x9D]/g, '') : '',
                  table_data: normalizeTableData(tbl.table_data),
                  table_order: tbl.table_order,
                })),
              },
            };
          })
        );
      } else {
        // Fallback: Use equipment_specs for backward compatibility with old data
        // IMPORTANTE: Normalizar los datos antiguos de equipment_specs para eliminar caracteres problemáticos
        equipment = equipmentDetails
          .filter((eq: any) => eq.equipment_specs)
          .map((eq: any) => {
            // Normalizar description si existe
            let normalizedDescription = '';
            if (eq.equipment_specs.description) {
              // Aplicar normalización básica antes de la normalización completa
              normalizedDescription = String(eq.equipment_specs.description)
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Eliminar emojis
                .replace(/[\uD800-\uDFFF]/g, '') // Eliminar surrogates
                .replace(/\u2713/g, 'v')  // CHECK MARK -> v
                .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
                .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
                .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
                .replace(/\u221A/g, 'sqrt') // SQUARE ROOT -> sqrt
                .replace(/√/g, 'sqrt') // Símbolo raíz cuadrada directo
                .replace(/[^\x00-\x7F\xA0-\xFF]/g, '') // Eliminar todo fuera de ASCII y Latin-1
                .replace(/[\x81\x8D\x8F\x90\x9D]/g, ''); // Eliminar controles problemáticos
            }
            
            // Normalize table data from old equipment_specs
            const normalizeTableData = (tableData: any): any => {
              if (!Array.isArray(tableData)) return [];
              return tableData.map((row: any) => {
                if (!Array.isArray(row)) return [];
                return row.map((cell: any) => {
                  const cellStr = String(cell || '');
                  return cellStr
                    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Eliminar emojis
                    .replace(/[\uD800-\uDFFF]/g, '') // Eliminar surrogates
                    .replace(/\u2713/g, 'v')  // CHECK MARK -> v
                    .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
                    .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
                    .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
                    .replace(/\u221A/g, 'sqrt') // SQUARE ROOT -> sqrt
                    .replace(/√/g, 'sqrt') // Símbolo raíz cuadrada directo
                    .replace(/[^\x00-\x7F\xA0-\xFF]/g, '') // Eliminar todo fuera de ASCII y Latin-1
                    .replace(/[\x81\x8D\x8F\x90\x9D]/g, ''); // Eliminar controles problemáticos
                });
              });
            };
            
            // Normalize tables from old equipment_specs
            const normalizedTables = (eq.equipment_specs.tables || []).map((tbl: any) => ({
              title: tbl.title ? String(tbl.title)
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
                .replace(/[\uD800-\uDFFF]/g, '')
                .replace(/\u2713/g, 'v')
                .replace(/\u2714/g, 'v')
                .replace(/\u2705/g, 'v')
                .replace(/\u2611/g, 'v')
                .replace(/\u221A/g, 'sqrt')
                .replace(/√/g, 'sqrt')
                .replace(/[^\x00-\x7F\xA0-\xFF]/g, '')
                .replace(/[\x81\x8D\x8F\x90\x9D]/g, '') : '',
              table_data: normalizeTableData(tbl.table_data),
              table_order: tbl.table_order || 0,
            }));
            
            return {
              equipment_name: eq.equipment_name || '',
            equipment_specs: {
                description: normalizedDescription,
              images: eq.equipment_specs.images || [],
                tables: normalizedTables,
            },
            };
          });
      }
    }

    console.log('✅ Datos consultados correctamente');

    // Función ULTRA AGRESIVA de normalización (misma que en pdf.ts)
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
      
      // MÉTODO 1: Eliminar TODOS los pares sustitutos (emojis) usando regex
      str = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // Pares completos
      str = str.replace(/[\uD800-\uDFFF]/g, ''); // Surrogates sueltos
      
      // MÉTODO 2: Reemplazar caracteres problemáticos conocidos
      str = str
        .replace(/\u2713/g, 'v')  // CHECK MARK (U+2713) -> v
        .replace(/\u2714/g, 'v')  // HEAVY CHECK MARK -> v
        .replace(/\u2705/g, 'v')  // WHITE HEAVY CHECK MARK -> v
        .replace(/\u2611/g, 'v')  // BALLOT BOX WITH CHECK -> v
        .replace(/\u221A/g, 'sqrt') // SQUARE ROOT (√) -> sqrt
        .replace(/√/g, 'sqrt') // Símbolo raíz cuadrada directo
        .replace(/\u221A/g, 'sqrt'); // SQUARE ROOT Unicode (doble verificación)
      
      // MÉTODO 3: Eliminar TODOS los caracteres fuera de WinAnsi usando regex
      // Eliminar símbolos matemáticos problemáticos específicamente primero
      str = str.replace(/[√∛∜]/g, ''); // Eliminar símbolos de raíz
      str = str.replace(/[^\x00-\x7F\xA0-\xFF]/g, ''); // Eliminar todo fuera de ASCII y Latin-1
      str = str.replace(/[\x81\x8D\x8F\x90\x9D]/g, ''); // Eliminar controles problemáticos
      
      // MÉTODO 4: Verificación final carácter por carácter
      let result = '';
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        
        // Eliminar caracteres problemáticos específicos
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
        
        if (code <= 127 || (code >= 160 && code <= 255 && 
            code !== 0x81 && code !== 0x8D && code !== 0x8F && 
            code !== 0x90 && code !== 0x9D)) {
          result += str[i];
        }
      }
      
      return result;
    };

    // Función para normalizar recursivamente todos los datos antes de pasarlos al PDF
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

    // Normalizar todos los datos antes de generar el PDF
    const normalizedProposal = normalizeData(proposal);
    const normalizedItems = normalizeData(items || []);
    const normalizedEquipment = normalizeData(equipment || []);
    const normalizedImages = normalizeData(images || []);

    const pdfBytes = await createProposalPDF({
      proposal: normalizedProposal,
      items: normalizedItems,
      equipment: normalizedEquipment,
      images: normalizedImages,
    });

    console.log('✅ PDF generado exitosamente');

    const filenameBase = `Propuesta_${proposal.offer_id ?? 'SIN_ID'}_${proposal.client ?? 'Cliente'}`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        ...buildPdfResponseHeaders(filenameBase),
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
