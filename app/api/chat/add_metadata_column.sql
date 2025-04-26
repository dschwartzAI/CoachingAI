-- Add metadata column to threads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'threads' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.threads ADD COLUMN metadata JSONB DEFAULT '{}';
        RAISE NOTICE 'Added metadata column to threads table';
    ELSE
        RAISE NOTICE 'metadata column already exists in threads table';
    END IF;
END $$; 