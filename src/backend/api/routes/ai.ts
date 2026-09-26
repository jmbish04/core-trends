/**
 * @fileoverview AI API routes.
 *
 * Text inference goes through core-guardian's RPC door (`src/backend/lib/guardian.ts`),
 * never `env.AI.run()` — see that file for why.
 *
 * Every route here — including speech-to-text and text-to-speech — goes through
 * the door. The `ai` binding is gone from this Worker entirely, which is the
 * point: an `env.AI.run()` call is account-implicit and cannot be attributed to
 * the Worker that made it, so the only reliable fix is to remove the binding.
 *
 * Text-to-speech needed core-guardian's binary passthrough (jmbish04/core-guardian#140)
 * because aura-1 answers with `audio/mpeg`. Speech-to-text never did — whisper
 * takes JSON in and returns JSON out; it was migratable all along.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../index';
import { GUARDIAN_PROJECT, guardianBody, guardianRun, isStream } from '../../lib/guardian';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Apply auth middleware
aiRouter.use('*', authMiddleware);

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
});

const speechToTextSchema = z.object({
  audio: z.string(), // base64 encoded audio
});

const textToSpeechSchema = z.object({
  text: z.string(),
  voice: z.string().optional(),
});

/**
 * Model selection for the chat routes.
 *
 * With no `model` in the request we send the `"cheapest"` sentinel and let
 * guardian route — that is the whole point of the door, and it can serve the
 * call from a flat-rate Ollama subscription instead of metered neurons. A
 * caller that names a model still gets it, but it is pinned and therefore
 * cannot be re-hosted; guardian records the decision either way.
 */
function modelArgs(model?: string) {
  if (!model) return { model: 'cheapest' as const };
  return model.startsWith('@cf/')
    ? { model, provider: 'workers-ai' }
    : { model };
}

// POST /api/ai/chat
aiRouter.post('/chat', zValidator('json', chatSchema), async (c) => {
  const { messages, model } = c.req.valid('json');

  try {
    const result = await guardianRun(c.env, {
      project: GUARDIAN_PROJECT,
      importance: 'low',
      task: 'chat',
      input: { messages },
      ...modelArgs(model),
    });

    return c.json(guardianBody(result) as Record<string, unknown>);
  } catch (error) {
    console.error('AI chat error:', error);
    return c.json({ error: 'AI chat failed' }, 500);
  }
});

// POST /api/ai/chat/stream
aiRouter.post('/chat/stream', zValidator('json', chatSchema), async (c) => {
  const { messages, model } = c.req.valid('json');

  try {
    const result = await guardianRun(c.env, {
      project: GUARDIAN_PROJECT,
      importance: 'low',
      task: 'chat',
      input: { messages },
      stream: true,
      ...modelArgs(model),
    });

    // A guardian refusal (budget, breaker, no model in budget) comes back as a
    // JSON envelope even when `stream: true` was asked for — surface it rather
    // than handing the client an empty stream.
    if (!isStream(result)) {
      guardianBody(result);
      return c.json({ error: 'AI chat stream failed' }, 500);
    }

    return new Response(result.stream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI chat stream error:', error);
    return c.json({ error: 'AI chat stream failed' }, 500);
  }
});

// POST /api/ai/speech-to-text
aiRouter.post('/speech-to-text', zValidator('json', speechToTextSchema), async (c) => {
  const { audio } = c.req.valid('json');

  try {
    // Decode base64 audio
    const audioBuffer = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));

    // Whisper takes JSON and returns JSON ({ text }), so this is an ordinary
    // door call. Model is pinned: transcription has no cheaper equivalent in
    // the catalog, and `isChatModel` excludes speech models from routing anyway.
    const result = await guardianRun(c.env, {
      project: GUARDIAN_PROJECT,
      importance: 'low',
      task: 'transcribe',
      model: '@cf/openai/whisper',
      provider: 'workers-ai',
      input: { audio: Array.from(audioBuffer) },
    });

    return c.json(guardianBody(result) as Record<string, unknown>);
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return c.json({ error: 'Speech-to-text failed' }, 500);
  }
});

// POST /api/ai/text-to-speech
aiRouter.post('/text-to-speech', zValidator('json', textToSpeechSchema), async (c) => {
  const { text, voice = 'alloy' } = c.req.valid('json');

  try {
    // aura-1 answers with `audio/mpeg`. core-guardian returns that as a Response
    // on the `stream` member (its binary passthrough), having already metered the
    // neurons from the `cf-ai-neurons` header.
    const result = await guardianRun(c.env, {
      project: GUARDIAN_PROJECT,
      importance: 'low',
      task: 'speak',
      model: '@cf/deepgram/aura-1',
      provider: 'workers-ai',
      input: { text, voice },
    });

    // A refusal (budget, breaker, no free neurons) comes back as JSON even here.
    // `guardianBody` turns a non-2xx into a throw so it cannot be mistaken for
    // silence from the model.
    if (!isStream(result)) {
      guardianBody(result);
      return c.json({ error: 'Text-to-speech failed' }, 500);
    }

    // ponytail: still base64 — this route's response shape is public and
    // callers parse `{ audio }`. Changing it to a raw audio body is a breaking
    // change, not a cleanup.
    const response = result.stream.body;
    if (response instanceof ReadableStream) {
      const reader = response.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }

      const base64Audio = btoa(String.fromCharCode(...audioData));
      return c.json({ audio: base64Audio });
    }

    return c.json({ error: 'Text-to-speech returned no audio' }, 502);
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return c.json({ error: 'Text-to-speech failed' }, 500);
  }
});

// POST /api/ai/embeddings
aiRouter.post('/embeddings', zValidator('json', z.object({ text: z.string().min(1) })), async (c) => {
  const { text } = c.req.valid('json');

  try {
    const result = await guardianRun(c.env, {
      project: GUARDIAN_PROJECT,
      importance: 'low',
      task: 'embed',
      // Pinned deliberately: an embedding must keep matching the vectors already
      // stored for it, so this is one of the few call sites where guardian must
      // NOT substitute a comparable model.
      model: '@cf/baai/bge-base-en-v1.5',
      provider: 'workers-ai',
      input: { text },
    });

    return c.json(guardianBody(result) as Record<string, unknown>);
  } catch (error) {
    console.error('Embeddings error:', error);
    return c.json({ error: 'Embeddings generation failed' }, 500);
  }
});

export { aiRouter };
