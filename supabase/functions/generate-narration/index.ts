// Supabase Edge Function (Deno runtime). Deploy with:
//   supabase functions deploy generate-narration
// Requires a project secret: `supabase secrets set OPENAI_API_KEY=sk-...`
//
// Input:  { aiJobId: string, projectId: string, text: string }
// Effect: synthesizes speech from `text` (OpenAI TTS), uploads the resulting
// mp3 to Supabase Storage, and writes the storage path onto the `ai_jobs`
// row. AiJob is server-authoritative while in flight — see
// src/remote/aiJobRemote.ts for why.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const STORAGE_BUCKET = 'vlog-projects';

interface RequestBody {
  aiJobId: string;
  projectId: string;
  text: string;
}

Deno.serve(async (req: Request) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let aiJobId: string | undefined;

  try {
    const body: RequestBody = await req.json();
    aiJobId = body.aiJobId;
    const { projectId, text } = body;

    if (!text || !text.trim()) {
      throw new Error('text is required');
    }

    await admin
      .from('ai_jobs')
      .update({ status: 'running', started_at: new Date().toISOString(), progress: 20 })
      .eq('id', aiJobId);

    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1', voice: 'alloy', input: text }),
    });
    if (!ttsResponse.ok) {
      throw new Error(`TTS API error: ${ttsResponse.status} ${await ttsResponse.text()}`);
    }
    const audioBytes = new Uint8Array(await ttsResponse.arrayBuffer());

    await admin.from('ai_jobs').update({ progress: 70 }).eq('id', aiJobId);

    const storagePath = `projects/${projectId}/narration/${aiJobId}.mp3`;
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, audioBytes, { contentType: 'audio/mpeg', upsert: true });
    if (uploadError) {
      throw new Error(`Failed to upload narration audio: ${uploadError.message}`);
    }

    await admin
      .from('ai_jobs')
      .update({
        status: 'completed',
        progress: 100,
        result: { storagePath },
        finished_at: new Date().toISOString(),
      })
      .eq('id', aiJobId);

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (aiJobId) {
      await admin
        .from('ai_jobs')
        .update({ status: 'failed', result: { error: message }, finished_at: new Date().toISOString() })
        .eq('id', aiJobId);
    }
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
