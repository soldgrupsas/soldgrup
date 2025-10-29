-- Add technical specifications table column to proposals
ALTER TABLE proposals 
ADD COLUMN technical_specs_table JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN proposals.technical_specs_table IS 'Stores technical specifications as a table (array of arrays)';
