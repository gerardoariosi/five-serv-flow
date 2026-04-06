-- Fix 1: Restrict master_pin SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can view master pin" ON master_pin;
CREATE POLICY "Admins can view master pin"
  ON master_pin FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Enforce sender_id ownership on chat_messages INSERT
DROP POLICY IF EXISTS "Authenticated users can send messages" ON chat_messages;
CREATE POLICY "Users can only send as themselves"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);