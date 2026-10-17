/**
 * One outbound HTTP call with a timeout that never throws and never logs.
 *
 * Callers log only the status — vendor URLs and bodies carry names, phones and addresses.
 */

export type HttpResult = {
  /** 0 when the request never got a response (timeout or network error). */
  status: number;
  json: unknown;
  error: "timeout" | "network" | null;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function httpJson(
  url: string,
  init: RequestInit,
  options: { timeoutMs: number; fetchImpl?: FetchLike }
): Promise<HttpResult> {
  const doFetch: FetchLike = options.fetchImpl ?? ((input, i) => fetch(input, i));
  try {
    const res = await doFetch(url, {
      ...init,
      signal: AbortSignal.timeout(Math.max(1_000, options.timeoutMs)),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { status: res.status, json, error: null };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    return { status: 0, json: null, error: timedOut ? "timeout" : "network" };
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
