// Supabase Edge Function (Deno runtime). Deploy with:
//   supabase functions deploy detect-highlights
// Requires a project secret: `supabase secrets set OPENAI_API_KEY=sk-...`
//
// Input:  { aiJobId: string, clips: { clipId: string; thumbnailStoragePath: string }[] }
// Effect: sends every clip's already-uploaded thumbnail (from M4's
// UPLOAD_CLIP task — no new upload plumbing needed) to a vision-capable
// model in a single request for relative comparison, writes back a
// recommendation list. This is advisory only — nothing is auto-applied; the
// client shows the list and the user taps "숨기기" per clip themselves.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const STORAGE_BUCKET = 'vlog-projects';

interface ClipRef {
  clipId: string;
  thumbnailStoragePath: string;
}

interface RequestBody {
  aiJobId: string;
  clips: ClipRef[];
}

interface Recommendation {
  clipId: string;
  score: number;
  reason: string;
  suggestion: 'keep' | 'hide';
}

Deno.serve(async (req: Request) => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let aiJobId: string | undefined;

  try {
    const body: RequestBody = await req.json();
    aiJobId = body.aiJobId;
    const { clips } = body;

    if (!clips || clips.length === 0) {
      throw new Error('No clips provided');
    }

    await admin
      .from('ai_jobs')
      .update({ status: 'running', started_at: new Date().toISOString(), progress: 20 })
      .eq('id', aiJobId);

    const imageContent = [];
    for (const clip of clips) {
      const { data: signed, error: signError } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(clip.thumbnailStoragePath, 300);
      if (signError || !signed?.signedUrl) {
        continue; // skip clips whose thumbnail couldn't be signed rather than failing the whole batch
      }
      imageContent.push({ type: 'text', text: `clipId: ${clip.clipId}` });
      imageContent.push({ type: 'image_url', image_url: { url: signed.signedUrl } });
    }

    if (imageContent.length === 0) {
      throw new Error('No clip thumbnails were accessible');
    }

    await admin.from('ai_jobs').update({ progress: 50 }).eq('id', aiJobId);

    const prompt =
      'You are helping a user pick highlights for a personal daily vlog. ' +
      'Each image below is a thumbnail frame from one recorded clip, labeled with its clipId. ' +
      'Compare them and, for EACH clipId, return a JSON object with: ' +
      'clipId (string, must match exactly), score (0-100 visual interest/quality), ' +
      'reason (one short sentence in Korean), suggestion ("keep" or "hide"). ' +
      'Respond with a JSON object of the exact shape {"recommendations": [...]} and nothing else.';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.5',
        response_format: { type: 'json_object' },
        max_completion_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, ...imageContent],
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status} ${await response.text()}`);
    }

    const completion = await response.json();
    const rawContent: string = completion.choices?.[0]?.message?.content ?? '{}';
    const parsed: { recommendations?: Recommendation[] } = JSON.parse(rawContent);
    const recommendations = parsed.recommendations ?? [];

    await admin
      .from('ai_jobs')
      .update({
        status: 'completed',
        progress: 100,
        result: { recommendations },
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
