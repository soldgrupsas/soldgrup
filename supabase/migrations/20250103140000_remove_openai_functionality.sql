-- Remove OpenAI API Key functionality
-- This migration removes all OpenAI-related functions and data from the database

-- Drop OpenAI-related functions
DROP FUNCTION IF EXISTS public.set_openai_api_key(text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_openai_api_key(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_openai_api_key_metadata() CASCADE;

-- Remove OpenAI API key data from application_secrets table (if exists)
-- Note: We keep the table structure in case it's needed for other purposes in the future
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'application_secrets') THEN
    DELETE FROM public.application_secrets WHERE key = 'openai_api_key';
  END IF;
END $$;

