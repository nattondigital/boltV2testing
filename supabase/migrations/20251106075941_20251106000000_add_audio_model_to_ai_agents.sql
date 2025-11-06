/*
  # Add Audio Model Support to AI Agents

  1. Changes
    - Add audio_model column to ai_agents table
    - Stores the LLM model used for audio transcription only
    - Defaults to 'google/gemini-2.5-flash-lite' for cost-effectiveness
    - Audio transcription uses this model
    - CRM operations continue using the main 'model' field

  2. Purpose
    - Separate audio transcription from main AI operations
    - Optimize costs by using lightweight models for speech-to-text
    - Main model handles complex CRM logic
    - Audio model handles fast, cheap transcription

  3. Implementation
    - Used in speech-to-text edge function
    - Configurable per agent in agent form
    - Independent from main model selection
*/

-- Add audio_model column to ai_agents table
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS audio_model text DEFAULT 'google/gemini-2.5-flash-lite';

-- Add comment to document the column
COMMENT ON COLUMN ai_agents.audio_model IS 'LLM model used for audio transcription. Main model field is used for CRM operations.';
