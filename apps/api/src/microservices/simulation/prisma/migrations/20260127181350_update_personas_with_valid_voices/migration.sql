-- Update personas with valid ElevenLabs voices
-- Delete old personas with invalid voices
DELETE FROM "public"."Persona" WHERE "id" IN ('persona_1', 'persona_2', 'persona_3', 'persona_4');

-- Insert new personas for each ElevenLabs voice
INSERT INTO "public"."Persona" ("id", "orgId", "name", "traits", "createdAt", "updatedAt")
VALUES
  (
    'persona_charlie',
    'global',
    'Charlie - Confident Sales Rep',
    '{"role": "Sales Executive", "level": "Expert", "personality": "Deep, confident, and energetic", "expertise": ["B2B sales", "Product demos", "Closing deals"], "tone": "Confident and persuasive", "background": "10+ years in enterprise software sales", "voice": {"provider": "elevenlabs", "voiceName": "Charlie - Deep, Confident, Energetic", "language": "en"}}',
    NOW(),
    NOW()
  ),
  (
    'persona_roger',
    'global',
    'Roger - Laid-Back Account Manager',
    '{"role": "Account Management", "level": "Senior", "personality": "Laid-back, casual, and resonant", "expertise": ["Relationship building", "Account growth", "Strategic planning"], "tone": "Casual and friendly", "background": "Easy going and perfect for casual conversations", "voice": {"provider": "elevenlabs", "voiceName": "Roger - Laid-Back, Casual, Resonant", "language": "en"}}',
    NOW(),
    NOW()
  ),
  (
    'persona_sarah',
    'global',
    'Sarah - Professional Consultant',
    '{"role": "Business Consultant", "level": "Expert", "personality": "Mature, reassuring, and confident", "expertise": ["Business strategy", "Change management", "Executive coaching"], "tone": "Professional and reassuring", "background": "Young adult woman with a confident and warm, mature quality", "voice": {"provider": "elevenlabs", "voiceName": "Sarah - Mature, Reassuring, Confident", "language": "en"}}',
    NOW(),
    NOW()
  ),
  (
    'persona_laura',
    'global',
    'Laura - Enthusiastic Trainer',
    '{"role": "Training & Development", "level": "Senior", "personality": "Enthusiastic with quirky attitude", "expertise": ["Employee training", "Workshop facilitation", "Motivational speaking"], "tone": "Sunny and enthusiastic", "background": "Young adult female voice that delivers enthusiasm with a quirky attitude", "voice": {"provider": "elevenlabs", "voiceName": "Laura - Enthusiast, Quirky Attitude", "language": "en"}}',
    NOW(),
    NOW()
  ),
  (
    'persona_george',
    'global',
    'George - Captivating Storyteller',
    '{"role": "Content Creator", "level": "Expert", "personality": "Warm and captivating", "expertise": ["Storytelling", "Presentations", "Public speaking"], "tone": "Warm and engaging", "background": "Warm resonance that instantly captivates listeners", "voice": {"provider": "elevenlabs", "voiceName": "George - Warm, Captivating Storyteller", "language": "en"}}',
    NOW(),
    NOW()
  ),
  (
    'persona_callum',
    'global',
    'Callum - Strategic Negotiator',
    '{"role": "Negotiations Expert", "level": "Senior", "personality": "Husky trickster with deceptive edge", "expertise": ["Deal negotiation", "Conflict resolution", "Strategic planning"], "tone": "Calculated and strategic", "background": "Deceptively gravelly, yet unsettling edge", "voice": {"provider": "elevenlabs", "voiceName": "Callum - Husky Trickster", "language": "en"}}',
    NOW(),
    NOW()
  ),
  (
    'persona_river',
    'global',
    'River - Calm Information Specialist',
    '{"role": "Information Services", "level": "Expert", "personality": "Relaxed, neutral, and informative", "expertise": ["Data analysis", "Research", "Technical documentation"], "tone": "Calm and informative", "background": "A relaxed, neutral voice ready for narrations or conversational projects", "voice": {"provider": "elevenlabs", "voiceName": "River - Relaxed, Neutral, Informative", "language": "en"}}',
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "traits" = EXCLUDED."traits",
  "updatedAt" = NOW();
