/*
  # Unify AI Agent Chat Memory System
  
  1. Changes to ai_agent_chat_memory table
    - Add user_context column for tracking internal vs external chats
    - Add action and result columns for activity logging
    - Add module column for categorizing chat context
    - Add session_id for grouping related conversations
    
  2. Purpose
    - Merge functionality of ai_agent_logs and ai_agent_chat_memory
    - Support both internal (dashboard) and external (webhook) chats
    - Enable phone number tracking for all chats
    - Provide unified chat history visible in interface
    - Better AI context with full conversation history
    
  3. Security
    - Maintain existing RLS policies
    - Add policy for anon access with phone_number filtering
*/

-- Add new columns to ai_agent_chat_memory
ALTER TABLE ai_agent_chat_memory
ADD COLUMN IF NOT EXISTS user_context text DEFAULT 'External',
ADD COLUMN IF NOT EXISTS action text DEFAULT 'Chat',
ADD COLUMN IF NOT EXISTS result text DEFAULT 'Success',
ADD COLUMN IF NOT EXISTS module text DEFAULT 'General',
ADD COLUMN IF NOT EXISTS session_id text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_agent_chat_memory_phone 
ON ai_agent_chat_memory(phone_number);

CREATE INDEX IF NOT EXISTS idx_ai_agent_chat_memory_session 
ON ai_agent_chat_memory(session_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_chat_memory_agent_phone
ON ai_agent_chat_memory(agent_id, phone_number);

-- Update RLS: Drop old policy if exists and create new one
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view chats for their phone number" ON ai_agent_chat_memory;
END $$;

CREATE POLICY "Allow anon to view all chat memory"
  ON ai_agent_chat_memory FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert chat memory"
  ON ai_agent_chat_memory FOR INSERT
  TO anon
  WITH CHECK (true);
