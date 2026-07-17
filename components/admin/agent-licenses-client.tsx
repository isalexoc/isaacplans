"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageOff, Loader2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminAgentLicense } from "@/lib/agent-licenses";

interface AgentLicensesClientProps {
  licenses: AdminAgentLicense[];
  states: { code: string; name: string }[];
}

export default function AgentLicensesClient({ licenses, states }: AgentLicensesClientProps) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bust, setBust] = useState<Record<string, number>>({});
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labelForKey = (key: string) =>
    key === "drivers"
      ? "Driver's License"
      : states.find((s) => s.code.toLowerCase() === key)?.name ?? key.toUpperCase();

  const handleUpload = async () => {
    if (!file || !selectedKey) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", selectedKey);

      const res = await fetch("/api/admin/agent-licenses/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      // Bust the browser-cached preview for this license (list keys are
      // "drivers" or uppercase state codes).
      const displayKey = selectedKey === "drivers" ? "drivers" : selectedKey.toUpperCase();
      setBust((prev) => ({ ...prev, [displayKey]: Date.now() }));
      setFailedPreviews((prev) => ({ ...prev, [displayKey]: false }));
      setSuccess(`${labelForKey(selectedKey)} image uploaded — stored privately in Cloudinary.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          Agent Licenses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          License images are stored privately in Cloudinary (authenticated delivery) and only
          viewable by signed-in admins. Uploading for a state that already has a license replaces
          its image.
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload a license image</CardTitle>
          <CardDescription>
            Pick the license, choose the image (JPEG, PNG, or WebP — max 4 MB), and upload. The
            Sanity license entry is created or updated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>License</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey} disabled={uploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a license" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drivers">Driver&apos;s License</SelectItem>
                  {states.map((state) => (
                    <SelectItem key={state.code} value={state.code.toLowerCase()}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-file">Image</Label>
              <Input
                id="license-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                ref={fileInputRef}
                disabled={uploading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {success}
            </p>
          )}

          <Button onClick={handleUpload} disabled={uploading || !file || !selectedKey} className="gap-2">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload license
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current licenses */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Current licenses ({licenses.length})
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {licenses.map((license) => (
            <Card key={license.key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  {license.name}
                  <span
                    className={
                      license.active
                        ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                        : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
                    }
                  >
                    {license.active ? "Active" : "Inactive"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {failedPreviews[license.key] || !license.active ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/40 text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="text-xs">Preview unavailable</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- streamed via the admin-gated proxy; next/image can't optimize it
                  <img
                    src={`/api/admin/license-image?key=${license.key}&w=600&h=400${
                      bust[license.key] ? `&v=${bust[license.key]}` : ""
                    }`}
                    alt={`${license.name} license`}
                    loading="lazy"
                    className="h-40 w-full rounded-md border object-contain bg-white"
                    onError={() =>
                      setFailedPreviews((prev) => ({ ...prev, [license.key]: true }))
                    }
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
