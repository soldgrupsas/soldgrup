-- Add new columns for the updated proposal form
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS offer_id TEXT,
ADD COLUMN IF NOT EXISTS presentation_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS client TEXT,
ADD COLUMN IF NOT EXISTS contact_person TEXT,
ADD COLUMN IF NOT EXISTS reference TEXT,
ADD COLUMN IF NOT EXISTS soldgrup_contact TEXT;

-- Update client_name and project_name to be nullable since we're changing the form structure
ALTER TABLE proposals 
ALTER COLUMN client_name DROP NOT NULL,
ALTER COLUMN project_name DROP NOT NULL;