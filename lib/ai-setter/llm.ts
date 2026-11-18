/**
 * Claude behind `LlmPort`: the official SDK (`@anthropic-ai/sdk`, pinned), beta Messages API, a
 * manual tool loop and server-side refusal fallbacks (`fallbacks: "default"`).
 *
 * - Byte-identical requests within a session: the system prompt and tools are built once, and the
 *   history is append-only. Each response's content goes back unchanged, thinking blocks included
 *   (prompt cache + preserved thinking).
 * - One tool call per API call (`disable_parallel_tool_use`). A terminal tool ends the loop;
 *   `retryWith()` answers it with the caller's feedback as an error result and loops again.
 * - Never throws. SDK errors become `{ kind: "error", detail: "<status|network>:<ErrorClass>" }`;
 *   the only retry is the client's single built-in one. A call still in flight at `deadlineAt` is
 *   aborted and reported as `deadline`.
 * - PII rule (log.ts): logs carry counts, stop reasons, refusal categories and error class names,
 *   never prompts, tool inputs, model text or API error bodies.
 *
 * No `server-only`: the CLI scripts load it too.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaFallbackMessageIterationUsage,
  BetaMessage,
  BetaMessageIterationUsage,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages";

import { PRICE_BY_MODEL, PRICE_MICROS, UNKNOWN_MODEL_RATES, type ModelRates } from "./config";
import type { AiSetterLogger, LlmLoopResult, LlmPort, LlmSession, LlmUsage, ToolDef, ToolExecResult } from "./types";

/** `fallbacks: "default"` needs exactly this beta (the 2026-06-01 one only takes the array form). */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const REQUEST_TIMEOUT_MS = 60_000;
/** No new call starts this close to the deadline. */
const DEADLINE_MARGIN_MS = 5_000;
/** All the model learns when a tool implementation throws. */
const TOOL_THREW = "internal error";
/** Answer for any extra tool_use block (the API promises at most one with `disable_parallel_tool_use`). */
const TOOL_SKIPPED = "not executed: one tool call per turn";
/**
 * Left out of an echoed assistant turn when they come before its final `fallback` block (SDK docs on
 * `BetaFallbackBlockParam`). Non-streaming responses already omit a declined partial, so this
 * normally changes nothing.
 */
const OMIT_BEFORE_FALLBACK: ReadonlySet<string> = new Set(["thinking", "redacted_thinking", "tool_use"]);
/** Rates are whole numbers of nano-USD, so the cost sum is exact before rounding up. */
const NANOS_PER_MICRO = 1000;

/** The subset of the Anthropic client this adapter calls, so tests can inject a fake. */
export type AnthropicLike = {
  beta: {
    messages: {
      create(params: MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }): Promise<BetaMessage>;
    };
  };
};

type LlmPortOptions = {
  apiKey: string;
  model: string;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  log: AiSetterLogger;
  /** Tests inject a fake; otherwise a real client is created on the first call. */
  client?: AnthropicLike;
};

type SessionInput = Parameters<LlmPort["startSession"]>[0];
type BaseParams = Omit<MessageCreateParamsNonStreaming, "messages">;
type TokenCounts = { input: number; output: number; cacheRead: number; cacheWrite: number };
type Rates = Record<keyof TokenCounts, number>;
type Deps = { client: () => AnthropicLike; log: AiSetterLogger };

type Session = {
  input: SessionInput;
  /** Everything but `messages`, built once: identical bytes on every call. */
  base: BaseParams;
  /** Append-only. */
  history: BetaMessageParam[];
  /**
   * Cumulative over every call of the session: tokens of every billed attempt, and their cost
   * in nano-USD, each attempt priced at the rates of the model that ran it.
   */
  totals: TokenCounts & { model: string; usedFallback: boolean; costNanos: number };
  calls: number;
  /** The terminal call's tool_use blocks, answered by retryWith(). */
  pending: BetaToolUseBlock[] | null;
};

type Ending =
  | { kind: "terminal"; toolName: string; input: unknown }
  | { kind: "no_action"; text: string }
  | { kind: "refused" | "max_tokens" | "deadline" | "error"; detail: string };

/** A loop step either ends the run or goes round again. */
type Step = LlmLoopResult | "continue";

type CallOutcome = { ok: true; response: BetaMessage; ms: number } | { ok: false; result: LlmLoopResult };

// ─── Cost ──────────────────────────────────────────────────────────────────────────────────

function nanoRates(fallback: boolean): Rates {
  const p = PRICE_MICROS;
  const micros: Rates = fallback
    ? { input: p.fallbackInput, output: p.fallbackOutput, cacheRead: p.fallbackInput * 0.1, cacheWrite: p.fallbackInput * 1.25 }
    : { input: p.input, output: p.output, cacheRead: p.cacheRead, cacheWrite: p.cacheWrite };
  return {
    input: Math.round(micros.input * NANOS_PER_MICRO),
    output: Math.round(micros.output * NANOS_PER_MICRO),
    cacheRead: Math.round(micros.cacheRead * NANOS_PER_MICRO),
    cacheWrite: Math.round(micros.cacheWrite * NANOS_PER_MICRO),
  };
}

/**
 * Micro-USD, rounded up, for these token counts at PRICE_MICROS rates. With `fallback`, at the
 * fallback models' rates: `fallbackInput` / `fallbackOutput`, cache reads at 0.1x and cache writes
 * at 1.25x the fallback input rate.
 */
export function costMicrosOf(
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
  fallback: boolean
): number {
  return Math.ceil(nanosAt(usage, nanoRates(fallback)) / NANOS_PER_MICRO);
}

function nanosAt(usage: TokenCounts, r: Rates): number {
  return usage.input * r.input + usage.output * r.output + usage.cacheRead * r.cacheRead + usage.cacheWrite * r.cacheWrite;
}

/** Nano-USD rates of one model id (an unlisted model gets the family's highest rates). */
function nanoRatesFor(model: string | null | undefined): Rates {
  const m: ModelRates = (model && PRICE_BY_MODEL[model]) || UNKNOWN_MODEL_RATES;
  return {
    input: Math.round(m.input * NANOS_PER_MICRO),
    output: Math.round(m.output * NANOS_PER_MICRO),
    cacheRead: Math.round(m.cacheRead * NANOS_PER_MICRO),
    cacheWrite: Math.round(m.cacheWrite * NANOS_PER_MICRO),
  };
}

// ─── Errors ────────────────────────────────────────────────────────────────────────────────

type ErrorClass = new (...args: never[]) => Error;

/** Most specific first. Explicit names, because a minified server bundle mangles `constructor.name`. */
const SDK_ERRORS: ReadonlyArray<readonly [ErrorClass, string]> = [
  [Anthropic.APIConnectionTimeoutError, "APIConnectionTimeoutError"],
  [Anthropic.APIConnectionError, "APIConnectionError"],
  [Anthropic.APIUserAbortError, "APIUserAbortError"],
  [Anthropic.BadRequestError, "BadRequestError"],
  [Anthropic.AuthenticationError, "AuthenticationError"],
  [Anthropic.PermissionDeniedError, "PermissionDeniedError"],
  [Anthropic.NotFoundError, "NotFoundError"],
  [Anthropic.RequestTimeoutError, "RequestTimeoutError"],
  [Anthropic.ConflictError, "ConflictError"],
  [Anthropic.PreconditionFailedError, "PreconditionFailedError"],
  [Anthropic.ContentTooLargeError, "ContentTooLargeError"],
  [Anthropic.UnprocessableEntityError, "UnprocessableEntityError"],
  [Anthropic.RateLimitError, "RateLimitError"],
  [Anthropic.RequestHeaderFieldsTooLargeError, "RequestHeaderFieldsTooLargeError"],
  [Anthropic.ClientClosedRequestError, "ClientClosedRequestError"],
  [Anthropic.OverloadedError, "OverloadedError"],
  [Anthropic.NotImplementedError, "NotImplementedError"],
  [Anthropic.ServiceUnavailableError, "ServiceUnavailableError"],
  [Anthropic.GatewayTimeoutError, "GatewayTimeoutError"],
  [Anthropic.InternalServerError, "InternalServerError"],
  [Anthropic.APIError, "APIError"],
  [Anthropic.AnthropicError, "AnthropicError"],
];

/** A class name that is safe to log: never the message. */
function errorClassName(error: unknown): string {
  const known = SDK_ERRORS.find(([cls]) => error instanceof cls);
  if (known) return known[1];
  const name = error instanceof Error ? error.name : "";
  return /^\w{1,40}$/.test(name) ? name : "Error";
}

/** "429:RateLimitError", "network:APIConnectionTimeoutError"; anything else "unknown:<Class>". */
function errorDetail(error: unknown): string {
  if (!(error instanceof Anthropic.APIError)) return `unknown:${errorClassName(error)}`;
  const status = typeof error.status === "number" ? String(error.status) : "network";
  return `${status}:${errorClassName(error)}`;
}

// ─── Request shape ─────────────────────────────────────────────────────────────────────────

function toBetaTool(tool: ToolDef): BetaTool {
  return {
    name: tool.name,
    description: tool.description,
    // Spreading keeps the schema's own key order; `type` is already "object" in a valid schema.
    input_schema: { ...tool.inputSchema, type: "object" },
    strict: true,
  };
}

function buildBaseParams(options: LlmPortOptions, input: SessionInput): BaseParams {
  return {
    model: options.model,
    max_tokens: options.maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: options.effort },
    system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
    tools: input.tools.map(toBetaTool),
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
  };
}

// ─── Results ───────────────────────────────────────────────────────────────────────────────

function usageOf(totals: Session["totals"]): LlmUsage {
  return {
    model: totals.model,
    inputTokens: totals.input,
    outputTokens: totals.output,
    cacheReadTokens: totals.cacheRead,
    cacheWriteTokens: totals.cacheWrite,
    costMicros: Math.ceil(totals.costNanos / NANOS_PER_MICRO),
    usedFallback: totals.usedFallback,
  };
}

function finish(s: Session, ending: Ending): LlmLoopResult {
  return { ...ending, usage: usageOf(s.totals), calls: s.calls };
}

function tokenCount(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/** The `fallback_message` usage entry is the real signal: sticky-routed turns carry no block. */
function servedByFallback(response: BetaMessage): boolean {
  return (
    (response.usage.iterations ?? []).some((entry) => entry.type === "fallback_message") ||
    response.content.some((block) => block.type === "fallback")
  );
}

/**
 * Adds this call's usage to the session totals; true when a fallback model served it.
 *
 * Under server-side fallback the top-level `usage` covers only the attempt that produced the
 * message; `usage.iterations` lists every attempt (a declined one included), each with its own
 * model. Each attempt is priced at that model's rates. A declined-before-output attempt may not
 * be billed in every category: counting it anyway keeps the daily cap on the safe side.
 */
function accumulate(s: Session, response: BetaMessage): boolean {
  const t = s.totals;
  const u = response.usage;
  const attempts = (u.iterations ?? []).filter(
    (e): e is BetaMessageIterationUsage | BetaFallbackMessageIterationUsage => e.type === "message" || e.type === "fallback_message"
  );
  const parts =
    attempts.length > 0
      ? attempts.map((e) => ({
          model: e.model ?? response.model ?? s.base.model,
          input: tokenCount(e.input_tokens),
          output: tokenCount(e.output_tokens),
          cacheRead: tokenCount(e.cache_read_input_tokens),
          cacheWrite: tokenCount(e.cache_creation_input_tokens),
        }))
      : [
          {
            model: response.model || s.base.model,
            input: tokenCount(u.input_tokens),
            output: tokenCount(u.output_tokens),
            cacheRead: tokenCount(u.cache_read_input_tokens),
            cacheWrite: tokenCount(u.cache_creation_input_tokens),
          },
        ];
  for (const part of parts) {
    t.input += part.input;
    t.output += part.output;
    t.cacheRead += part.cacheRead;
    t.cacheWrite += part.cacheWrite;
    t.costNanos += nanosAt(part, nanoRatesFor(part.model));
  }
  const fallback = servedByFallback(response);
  t.usedFallback = t.usedFallback || fallback;
  t.model = response.model || t.model;
  return fallback;
}

function logCall(log: AiSetterLogger, s: Session, response: BetaMessage, fallback: boolean, ms: number): void {
  log.debug("llm call", {
    call: s.calls,
    stopReason: response.stop_reason,
    model: response.model,
    fallback,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens,
    cacheWriteTokens: response.usage.cache_creation_input_tokens,
    ms,
  });
}

// ─── History ───────────────────────────────────────────────────────────────────────────────

/** The assistant turn as it must be echoed back (unchanged unless a fallback split it). */
function echoContent(content: BetaContentBlock[]): BetaContentBlock[] {
  const boundary = content.findLastIndex((block) => block.type === "fallback");
  if (boundary <= 0) return content;
  return content.filter((block, i) => i >= boundary || !OMIT_BEFORE_FALLBACK.has(block.type));
}

/** An empty assistant turn would be rejected by the API, so it is not appended. */
function appendAssistant(s: Session, content: BetaContentBlock[]): void {
  if (content.length > 0) s.history.push({ role: "assistant", content });
}

/** One user message answering every tool_use block of the turn; the first gets the real result. */
function toolResults(toolUses: BetaToolUseBlock[], content: string, isError: boolean): BetaMessageParam {
  const blocks: BetaToolResultBlockParam[] = toolUses.map((block, i) => ({
    type: "tool_result",
    tool_use_id: block.id,
    content: i === 0 ? content : TOOL_SKIPPED,
    is_error: i === 0 ? isError : true,
  }));
  return { role: "user", content: blocks };
}

function joinedText(content: BetaContentBlock[]): string {
  return content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
}

// ─── Loop ──────────────────────────────────────────────────────────────────────────────────

async function runTool(
  execute: SessionInput["executeTool"],
  block: BetaToolUseBlock,
  log: AiSetterLogger
): Promise<ToolExecResult> {
  try {
    return await execute(block.name, block.input);
  } catch (error) {
    log.warn("tool threw", { tool: block.name, error: errorClassName(error) });
    return { content: TOOL_THREW, isError: true };
  }
}

async function onToolUse(s: Session, deps: Deps, content: BetaContentBlock[]): Promise<Step> {
  appendAssistant(s, content);
  const toolUses = content.filter((block): block is BetaToolUseBlock => block.type === "tool_use");
  const first = toolUses[0];
  if (!first) return finish(s, { kind: "no_action", text: joinedText(content) });
  const result = await runTool(s.input.executeTool, first, deps.log);
  if (result.terminal) {
    s.pending = toolUses;
    return finish(s, { kind: "terminal", toolName: first.name, input: first.input });
  }
  s.history.push(toolResults(toolUses, result.content, result.isError === true));
  return "continue";
}

async function onResponse(s: Session, deps: Deps, response: BetaMessage, ms: number): Promise<Step> {
  const fallback = accumulate(s, response);
  logCall(deps.log, s, response, fallback, ms);
  const content = echoContent(response.content);
  switch (response.stop_reason) {
    case "refusal": {
      const category = response.stop_details?.category ?? null;
      deps.log.warn("llm refused", { call: s.calls, category, fallback });
      return finish(s, { kind: "refused", detail: category ?? "refusal" });
    }
    case "max_tokens":
    case "model_context_window_exceeded":
      return finish(s, { kind: "max_tokens", detail: response.stop_reason });
    case "pause_turn":
      appendAssistant(s, content);
      return "continue";
    case "tool_use":
      return onToolUse(s, deps, content);
    default:
      appendAssistant(s, content);
      return finish(s, { kind: "no_action", text: joinedText(content) });
  }
}

async function callModel(s: Session, deps: Deps): Promise<CallOutcome> {
  // Bounds the whole call (the client's retry included) by the turn deadline.
  const signal = AbortSignal.timeout(Math.max(1, s.input.deadlineAt - Date.now()));
  const startedAt = Date.now();
  s.calls += 1;
  try {
    const params: MessageCreateParamsNonStreaming = { ...s.base, messages: [...s.history] };
    const response = await deps.client().beta.messages.create(params, { signal });
    return { ok: true, response, ms: Date.now() - startedAt };
  } catch (error) {
    const ms = Date.now() - startedAt;
    if (signal.aborted) {
      deps.log.warn("llm call reached the turn deadline", { call: s.calls, ms });
      return { ok: false, result: finish(s, { kind: "deadline", detail: "deadline_in_call" }) };
    }
    const detail = errorDetail(error);
    deps.log.warn("llm call failed", { call: s.calls, detail, ms });
    return { ok: false, result: finish(s, { kind: "error", detail }) };
  }
}

async function runLoop(s: Session, deps: Deps): Promise<LlmLoopResult> {
  while (s.calls < s.input.maxCalls) {
    if (Date.now() > s.input.deadlineAt - DEADLINE_MARGIN_MS) return finish(s, { kind: "deadline", detail: "deadline" });
    const outcome = await callModel(s, deps);
    if (!outcome.ok) return outcome.result;
    const step = await onResponse(s, deps, outcome.response, outcome.ms);
    if (step !== "continue") return step;
  }
  return finish(s, { kind: "error", detail: "max_calls" });
}

/** Last line of the never-throw promise: an unexpected exception still ends as a result. */
async function guardedLoop(s: Session, deps: Deps): Promise<LlmLoopResult> {
  try {
    return await runLoop(s, deps);
  } catch (error) {
    const detail = `unknown:${errorClassName(error)}`;
    deps.log.error("llm loop crashed", { calls: s.calls, detail });
    return finish(s, { kind: "error", detail });
  }
}

function createSession(options: LlmPortOptions, deps: Deps, input: SessionInput): LlmSession {
  const s: Session = {
    input,
    base: buildBaseParams(options, input),
    history: [{ role: "user", content: input.userContent }],
    totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, model: options.model, usedFallback: false, costNanos: 0 },
    calls: 0,
    pending: null,
  };
  return {
    run() {
      // A terminal tool_use is still unanswered: another call would be a 400. Use retryWith().
      if (s.pending) return Promise.resolve(finish(s, { kind: "error", detail: "pending_tool_use" }));
      return guardedLoop(s, deps);
    },
    retryWith(feedback) {
      s.history.push(s.pending ? toolResults(s.pending, feedback, true) : { role: "user", content: feedback });
      s.pending = null;
      return guardedLoop(s, deps);
    },
  };
}

/**
 * `LlmPort` on Claude. One client per port, created on the first API call unless `client` is
 * injected. Every call sends: `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`,
 * `output_config.effort`, the system prompt as one cached text block, the tools with
 * `strict: true`, and `tool_choice: auto` with parallel tool use off. No `thinking` (always adaptive
 * on Opus 5.5) and no sampling parameters.
 */
export function createLlmPort(options: LlmPortOptions): LlmPort {
  let client: AnthropicLike | null = options.client ?? null;
  const deps: Deps = {
    log: options.log,
    client: () => {
      if (!client) client = new Anthropic({ apiKey: options.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
      return client;
    },
  };
  return { startSession: (input) => createSession(options, deps, input) };
}
