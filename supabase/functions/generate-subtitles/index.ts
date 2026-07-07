// Supabase Edge Function (Deno runtime). Deploy with:
//   supabase functions deploy generate-subtitles
// Requires a project secret: `supabase secrets set OPENAI_API_KEY=sk-...`
//
// Input:  { aiJobId: string, exportVersionId: string }
// Effect: transcribes the export's video (via OpenAI Whisper) and writes the
// result onto the `ai_jobs` row. The client (services/aiService.ts) polls
// that row — AiJob is server-authoritative while a job is in flight, unlike
// every other entity in this app, which is local-first (architecture note in
// aiService.ts/aiJobRemote.ts).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const STORAGE_BUCKET = 'vlog-projects';

interface RequestBody {
  aiJobId: string;
  exportVersionId: string;
}

interface WhisperSegment {
  text: string;
  start: number;
  end: number;
}

Deno.serve(async (req: Request) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let aiJobId: string | undefined;

  try {
    const body: RequestBody = await req.json();
    aiJobId = body.aiJobId;
    const { exportVersionId } = body;

    await admin
      .from('ai_jobs')
      .update({ status: 'running', started_at: new Date().toISOString(), progress: 10 })
      .eq('id', aiJobId);

    const { data: version, error: versionError } = await admin
      .from('export_versions')
      .select('remote_uri')
      .eq('id', exportVersionId)
      .single();
    if (versionError || !version?.remote_uri) {
      throw new Error(`Export version has no uploaded file: ${versionError?.message ?? 'not found'}`);
    }

    const { data: fileBlob, error: downloadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(version.remote_uri);
    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download export: ${downloadError?.message ?? 'unknown'}`);
    }

    await admin.from('ai_jobs').update({ progress: 40 }).eq('id', aiJobId);

    const formData = new FormData();
    formData.append('file', fileBlob, 'export.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });
    if (!whisperResponse.ok) {
      throw new Error(`Whisper API error: ${whisperResponse.status} ${await whisperResponse.text()}`);
    }
    const transcription: { segments: WhisperSegment[] } = await whisperResponse.json();

    const segments = transcription.segments.map((segment) => ({
      text: segment.text.trim(),
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
    }));

    await admin
      .from('ai_jobs')
      .update({
        status: 'completed',
        progress: 100,
        result: { exportVersionId, segments },
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
