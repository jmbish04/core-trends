/**
 * @fileoverview core-guardian inference client — the one door out of this
 * Worker to any model provider.
 *
 * Why this exists: an `env.AI.run()` call is account-implicit. It always lands
 * on the paid Cloudflare account, it cannot be metered per-account, and nothing
 * records which Worker spent the neurons. Measured 2026-09-25 across the fleet:
 * 111 of 218 deployed Workers hold an `ai` binding, and Cloudflare's own
 * analytics has no `scriptName` dimension — so after-the-fact attribution is
 * impossible. The only fix is to stop calling the binding.
 *
 * Going through guardian buys three things this Worker cannot do for itself:
 *   1. **Attribution** — the call lands in `ai_router_requests` with a project.
 *   2. **Routing** — guardian picks the cheapest model that meets the need,
 *      including re-hosting a Workers AI model on Ollama Cloud (flat monthly
 *      subscription, $0 marginal) when it serves the same model.
 *   3. **Guardrails** — budget caps, circuit breakers and the daily neuron
 *      ceiling stay in the path. Cloudflare does NOT stop at the free 10,000
 *      neurons/day on a paid account; past it, it silently bills.
 *
 * Transport is the RPC service binding, not HTTP: no credential to manage,
 * because the binding itself is the trust boundary.
 *
 * Contract source of truth is core-guardian's `runBody` zod schema
 * (`src/backend/api/routes/ai-router.ts`). We keep a loose shape here on
 * purpose — mirroring the schema would fork it on every guardian change.
 *
 * @see /Volumes/Projects/workers/core-guardian/src/backend/guardian/ai-router/rpc.ts
 */

/** Guardian's routing/billing scope for everything this Worker sends. */
export const GUARDIAN_PROJECT = "core-trends";

export interface GuardianRunPayload {
  /** Billing/routing project key. */
  project: string;
  importance: "low" | "medium" | "high";
  /** Provider-shaped input — `{ messages }` for chat, `{ text }` for embeddings. */
  input: unknown;
  /**
   * A concrete model id, or a sentinel — `"auto" | "best" | "budget" | "cheapest"` —
   * to let guardian pick. Prefer a sentinel: a pinned model is the thing that
   * stops guardian finding a cheaper equivalent.
   */
  model?: string;
  /** Required when `model` is concrete. */
  provider?: string;
  use_case?: string;
  stream?: boolean;
  task?: string;
  complexity?: "low" | "medium" | "high";
}

export type GuardianRunResult =
  | { status: number; body: unknown }
  | { stream: Response };

/** The `ai` binding was removed for this call path but GUARDIAN was not added. */
export class GuardianNotConfiguredError extends Error {
  constructor() {
    super(
      'GUARDIAN service binding missing. Add { "binding": "GUARDIAN", "service": "core-guardian", "entrypoint": "GuardianRpc" } to wrangler.jsonc under "services" and redeploy.',
    );
    this.name = "GuardianNotConfiguredError";
  }
}

type GuardianStub = {
  run(payload: unknown): Promise<GuardianRunResult>;
  route(payload: unknown): Promise<unknown>;
};

/**
 * Run one inference through core-guardian.
 *
 * @throws {GuardianNotConfiguredError} when the service binding is absent.
 * @throws when guardian's own `runBody` rejects the payload (a caller bug).
 */
export async function guardianRun(
  env: { GUARDIAN?: unknown },
  payload: GuardianRunPayload,
): Promise<GuardianRunResult> {
  if (!env.GUARDIAN) throw new GuardianNotConfiguredError();
  return (env.GUARDIAN as unknown as GuardianStub).run(payload);
}

/** True when guardian answered with a stream rather than a JSON envelope. */
export function isStream(
  r: GuardianRunResult,
): r is { stream: Response } {
  return "stream" in r;
}

/**
 * The JSON body of a non-streaming result.
 *
 * Guardian returns the provider's own envelope under `body`, so callers that
 * used to hand `env.AI.run()`'s return value straight back to the client keep
 * working. A non-2xx `status` is surfaced as a throw rather than silently
 * returned, so a guardian-side refusal (budget, breaker, no model in budget)
 * cannot be mistaken for a model answer.
 */
export function guardianBody(r: GuardianRunResult): unknown {
  if (isStream(r)) {
    throw new Error("guardianBody called on a streaming result — use isStream() first.");
  }
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`core-guardian refused the call (${r.status}): ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  return r.body;
}
