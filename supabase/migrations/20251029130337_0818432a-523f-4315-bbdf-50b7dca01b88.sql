-- Add observations column to proposals table
ALTER TABLE proposals 
ADD COLUMN IF NOT EXISTS observations TEXT;