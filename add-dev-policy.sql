-- Add policies for development users (starting with 'dev-user')
-- These should only be used in development environments

-- Thread policies for dev users
CREATE POLICY "Allow dev users to select threads" 
  ON public.threads 
  FOR SELECT 
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to insert threads" 
  ON public.threads 
  FOR INSERT 
  WITH CHECK (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to update threads" 
  ON public.threads 
  FOR UPDATE 
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to delete threads" 
  ON public.threads 
  FOR DELETE 
  USING (user_id LIKE 'dev-user-%');

-- Message policies for dev users
CREATE POLICY "Allow dev users to select messages" 
  ON public.messages 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM threads 
      WHERE threads.id = messages.thread_id 
      AND threads.user_id LIKE 'dev-user-%'
    )
  );

CREATE POLICY "Allow dev users to insert messages" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads 
      WHERE threads.id = messages.thread_id 
      AND threads.user_id LIKE 'dev-user-%'
    )
  );

-- To remove these policies if needed:
/*
DROP POLICY "Allow dev users to select threads" ON public.threads;
DROP POLICY "Allow dev users to insert threads" ON public.threads;
DROP POLICY "Allow dev users to update threads" ON public.threads;
DROP POLICY "Allow dev users to delete threads" ON public.threads;
DROP POLICY "Allow dev users to select messages" ON public.messages;
DROP POLICY "Allow dev users to insert messages" ON public.messages;
*/ 