import type {
  LeaveBehindAgentProfile,
  LeaveBehindAgentProfileInput,
} from "@/lib/leave-behind-agent-profile";
import type { LeaveBehindImageKind } from "@/lib/leave-behind-cloudinary";

export async function fetchLeaveBehindAgentProfile(): Promise<LeaveBehindAgentProfile | null> {
  const res = await fetch("/api/leave-behind/agent-profile");
  const data = await res.json();
  if (!res.ok || !data.success) return null;
  return data.profile ?? null;
}

export async function saveLeaveBehindAgentProfile(
  input: LeaveBehindAgentProfileInput
): Promise<LeaveBehindAgentProfile> {
  const res = await fetch("/api/leave-behind/agent-profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Failed to save profile");
  }
  return data.profile;
}

export async function uploadLeaveBehindAgentImage(
  file: File,
  kind: LeaveBehindImageKind
): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);
  const res = await fetch("/api/leave-behind/agent-profile/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Failed to upload image");
  }
  return { url: data.url as string, publicId: data.publicId as string };
}

/** @deprecated Use uploadLeaveBehindAgentImage */
export async function uploadLeaveBehindAgentPhoto(file: File): Promise<string> {
  const { url } = await uploadLeaveBehindAgentImage(file, "profile_photo");
  return url;
}
