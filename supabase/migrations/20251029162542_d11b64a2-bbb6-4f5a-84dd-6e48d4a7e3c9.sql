-- Add offer_details column to proposals table
ALTER TABLE public.proposals
ADD COLUMN offer_details text;