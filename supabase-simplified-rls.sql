-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS "public"."threads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "user_id" TEXT,  -- Change to TEXT to allow both UUID and string dev IDs
  "tool_id" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "threads_user_id_idx" ON "public"."threads" ("user_id");
CREATE INDEX IF NOT EXISTS "messages_thread_id_idx" ON "public"."messages" ("thread_id");

-- Enable RLS but with permissive policies for development
ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- SIMPLIFIED POLICIES FOR DEVELOPMENT
-- Allow all operations on threads
CREATE POLICY "Allow all operations on threads" 
  ON "public"."threads" 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Allow all operations on messages
CREATE POLICY "Allow all operations on messages" 
  ON "public"."messages" 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Triggers to update the 'updated_at' timestamp on threads
CREATE OR REPLACE FUNCTION update_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_timestamp
BEFORE UPDATE ON "public"."threads"
FOR EACH ROW
EXECUTE PROCEDURE update_thread_updated_at();

-- Create trigger to update thread 'updated_at' when a new message is inserted
CREATE OR REPLACE FUNCTION update_thread_updated_at_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "public"."threads"
  SET updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_on_message
AFTER INSERT ON "public"."messages"
FOR EACH ROW
EXECUTE PROCEDURE update_thread_updated_at_on_message(); 