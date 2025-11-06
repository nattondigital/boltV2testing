/*
  # Create Speech-to-Text Logs Table

  1. Purpose
    - Track audio transcription usage
    - Monitor costs and performance
    - Debug transcription issues
    - Analytics on STT feature usage

  2. New Tables
    - `speech_to_text_logs`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, foreign key to ai_agents)
      - `audio_duration_seconds` (numeric, length of audio)
      - `transcription` (text, the resulting text)
      - `method` (text, 'browser' or 'openrouter')
      - `model` (text, LLM model used from audio_model field)
      - `cost` (numeric, estimated cost in USD)
      - `created_at` (timestamptz, timestamp)

  3. Security
    - Enable RLS on speech_to_text_logs table
    - Add policies for anon insert and read access
    - Add indexes for performance
*/

-- Create speech_to_text_logs table
CREATE TABLE IF NOT EXISTS speech_to_text_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  audio_duration_seconds numeric NOT NULL,
  transcription text,
  method text NOT NULL CHECK (method IN ('browser', 'openrouter')),
  model text,
  cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE speech_to_text_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow anon insert to speech_to_text_logs"
  ON speech_to_text_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon read to speech_to_text_logs"
  ON speech_to_text_logs
  FOR SELECT
  TO anon
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_speech_to_text_logs_agent_id ON speech_to_text_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_speech_to_text_logs_created_at ON speech_to_text_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE speech_to_text_logs IS 'Tracks speech-to-text transcription usage and costs';
