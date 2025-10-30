const FALLBACK_FILENAME = 'Propuesta_Soldgrup';

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const sanitizeAscii = (value: string) => {
  const stripped = stripDiacritics(value)
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  return stripped || FALLBACK_FILENAME;
};

const encodeRFC5987ValueChars = (value: string) =>
  encodeURIComponent(value)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%(7C|60|5E)/g, (match) => `%25${match.slice(1)}`);

export const buildPdfResponseHeaders = (baseName: string) => {
  const safeBase = sanitizeAscii(baseName);
  const encoded = encodeRFC5987ValueChars(`${baseName}.pdf`);

  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeBase}.pdf"; filename*=UTF-8''${encoded}`,
  };
};
