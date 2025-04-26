-- Create schema if it doesn't exist (useful for multitenant projects)
CREATE SCHEMA IF NOT EXISTS "public";

-- Enable Row Level Security (RLS)
ALTER DATABASE postgres SET "app.settings.enableRowLevelSecurity" = TRUE;

-- Create tables

-- Threads table - stores chat threads
CREATE TABLE IF NOT EXISTS "public"."threads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "user_id" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  "tool_id" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table - stores individual messages within threads
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

-- Set up realtime
ALTER TABLE "public"."messages" REPLICA IDENTITY FULL;
ALTER TABLE "public"."threads" REPLICA IDENTITY FULL;

-- Enable realtime for these tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE threads, messages;
COMMIT;

-- Row Level Security (RLS) policies
-- 1. Thread policies
ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;

-- Users can view their own threads
CREATE POLICY "Users can view their own threads" 
  ON "public"."threads" 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own threads
CREATE POLICY "Users can insert their own threads" 
  ON "public"."threads" 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own threads
CREATE POLICY "Users can update their own threads" 
  ON "public"."threads" 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own threads
CREATE POLICY "Users can delete their own threads" 
  ON "public"."threads" 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 2. Message policies
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their threads
CREATE POLICY "Users can view messages in their threads" 
  ON "public"."messages" 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM threads 
      WHERE threads.id = messages.thread_id 
      AND threads.user_id = auth.uid()
    )
  );

-- Users can insert messages in their threads
CREATE POLICY "Users can insert messages in their threads" 
  ON "public"."messages" 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads 
      WHERE threads.id = messages.thread_id 
      AND threads.user_id = auth.uid()
    )
  );

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