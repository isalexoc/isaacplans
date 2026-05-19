import type {
  LeaveBehindClientRecord,
  LeaveBehindQuoteData,
  LeaveBehindQuoteType,
} from "@/lib/leave-behind-clients";

type ApiClient = LeaveBehindClientRecord;

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 401
        ? "Please sign in to continue."
        : "Server returned an unexpected response. Try refreshing the page."
    );
  }
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function fetchLeaveBehindClients(): Promise<LeaveBehindClientRecord[]> {
  const data = await parseJson<{ success: boolean; clients: ApiClient[] }>(
    await fetch("/api/leave-behind/clients", { credentials: "same-origin" })
  );
  return data.clients;
}

export async function saveLeaveBehindClient(input: {
  id?: string | null;
  quoteType: LeaveBehindQuoteType;
  prospectName?: string | null;
  quoteData: LeaveBehindQuoteData;
}): Promise<LeaveBehindClientRecord> {
  const isUpdate = Boolean(input.id);
  const url = isUpdate
    ? `/api/leave-behind/clients/${input.id}`
    : "/api/leave-behind/clients";
  const data = await parseJson<{ success: boolean; client: ApiClient }>(
    await fetch(url, {
      method: isUpdate ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteType: input.quoteType,
        prospectName: input.prospectName ?? null,
        quoteData: input.quoteData,
      }),
    })
  );
  return data.client;
}

export async function deleteLeaveBehindClient(id: string): Promise<void> {
  await parseJson(
    await fetch(`/api/leave-behind/clients/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
  );
}
