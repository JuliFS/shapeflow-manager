
-- Add quote_type and quote_data columns to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_type text NOT NULL DEFAULT '3d_print',
ADD COLUMN IF NOT EXISTS quote_data jsonb DEFAULT '{}';

-- Update existing quotes to have the correct type
UPDATE public.quotes SET quote_type = '3d_print' WHERE quote_type IS NULL OR quote_type = '';
