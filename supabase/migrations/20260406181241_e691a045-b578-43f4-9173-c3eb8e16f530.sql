
-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Add role_access column to chat_groups for role-based filtering
ALTER TABLE public.chat_groups ADD COLUMN IF NOT EXISTS role_access text[] DEFAULT '{}';

-- Add unread tracking table
CREATE TABLE IF NOT EXISTS public.chat_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own read status"
  ON public.chat_read_status FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
