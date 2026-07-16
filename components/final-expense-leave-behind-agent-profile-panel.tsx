"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLeaveBehindAgentProfile } from "@/components/leave-behind/leave-behind-agent-profile-context";
import {
  saveLeaveBehindAgentProfile,
  uploadLeaveBehindAgentImage,
} from "@/lib/leave-behind-agent-profile-api";
import {
  isLeaveBehindAgentProfileComplete,
  type LeaveBehindAgentProfile,
} from "@/lib/leave-behind-agent-profile";

const DEFAULT_TITLE = "Licensed Insurance Agent";

type FormState = {
  firstName: string;
  lastName: string;
  professionalTitle: string;
  phone: string;
  email: string;
  profileImageUrl: string;
  profileImagePublicId: string;
  companyLogoUrl: string;
  companyLogoPublicId: string;
};

function emptyForm(): FormState {
  return {
    firstName: "",
    lastName: "",
    professionalTitle: DEFAULT_TITLE,
    phone: "",
    email: "",
    profileImageUrl: "",
    profileImagePublicId: "",
    companyLogoUrl: "",
    companyLogoPublicId: "",
  };
}

function profileToForm(profile: LeaveBehindAgentProfile | null): FormState {
  if (!profile) return emptyForm();
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    professionalTitle: profile.professionalTitle || DEFAULT_TITLE,
    phone: profile.phone,
    email: profile.email,
    profileImageUrl: profile.profileImageUrl,
    profileImagePublicId: profile.profileImagePublicId,
    companyLogoUrl: profile.companyLogoUrl,
    companyLogoPublicId: profile.companyLogoPublicId,
  };
}

type FormErrorKey = keyof FormState;

type FinalExpenseLeaveBehindAgentProfilePanelProps = {
  onSaved?: () => void;
};

export default function FinalExpenseLeaveBehindAgentProfilePanel({
  onSaved,
}: FinalExpenseLeaveBehindAgentProfilePanelProps = {}) {
  const t = useTranslations("finalExpenseLeaveBehind");
  const { profile, loading, setProfile } = useLeaveBehindAgentProfile();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FormErrorKey, boolean>>>({});

  useEffect(() => {
    if (!loading) {
      setForm(profileToForm(profile));
    }
  }, [loading, profile]);

  const validate = (): boolean => {
    const next: Partial<Record<FormErrorKey, boolean>> = {};
    if (!form.firstName.trim()) next.firstName = true;
    if (!form.lastName.trim()) next.lastName = true;
    if (!form.profileImageUrl.trim()) next.profileImageUrl = true;
    if (!form.companyLogoUrl.trim()) next.companyLogoUrl = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
    setMessage(null);
    try {
      const { url, publicId } = await uploadLeaveBehindAgentImage(file, "profile_photo");
      setForm((f) => ({
        ...f,
        profileImageUrl: url,
        profileImagePublicId: publicId,
      }));
      if (errors.profileImageUrl) setErrors((e) => ({ ...e, profileImageUrl: false }));
    } catch {
      setMessage(t("agentProfile.uploadFailed"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    setMessage(null);
    try {
      const { url, publicId } = await uploadLeaveBehindAgentImage(file, "company_logo");
      setForm((f) => ({
        ...f,
        companyLogoUrl: url,
        companyLogoPublicId: publicId,
      }));
      if (errors.companyLogoUrl) setErrors((e) => ({ ...e, companyLogoUrl: false }));
    } catch {
      setMessage(t("agentProfile.logoUploadFailed"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveLeaveBehindAgentProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        professionalTitle: form.professionalTitle,
        phone: form.phone,
        email: form.email,
        profileImageUrl: form.profileImageUrl,
        profileImagePublicId: form.profileImagePublicId,
        companyLogoUrl: form.companyLogoUrl,
        companyLogoPublicId: form.companyLogoPublicId,
        markOnboardingComplete: true,
      });
      setProfile(saved);
      if (isLeaveBehindAgentProfileComplete(saved)) {
        onSaved?.();
        return;
      }
      setMessage(t("agentProfile.saved"));
    } catch {
      setMessage(t("agentProfile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="py-12 text-center text-muted-foreground">{t("agentProfile.loading")}</p>
    );
  }

  const complete = isLeaveBehindAgentProfileComplete({
    firstName: form.firstName,
    lastName: form.lastName,
    profileImageUrl: form.profileImageUrl,
    companyLogoUrl: form.companyLogoUrl,
  });

  return (
    <div className="mx-auto max-w-xl space-y-8 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8">
      <div>
        <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300">
          {t("agentProfile.title")}
        </h2>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{t("agentProfile.description")}</p>
        {complete && (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            {t("agentProfile.completeBadge")}
          </p>
        )}
      </div>

      <section className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
        <h3 className="font-semibold text-[#003366] dark:text-sky-300">
          {t("agentProfile.companyLogo")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("agentProfile.logoHint")}</p>
        <div
          className={cn(
            "flex min-h-[100px] items-center justify-center rounded-lg border bg-white p-4 dark:bg-gray-900",
            errors.companyLogoUrl ? "border-red-500" : "border-border"
          )}
        >
          {form.companyLogoUrl ? (
            <img
              src={form.companyLogoUrl}
              alt=""
              className="max-h-20 max-w-full object-contain"
            />
          ) : (
            <span className="text-sm text-muted-foreground">{t("agentProfile.logoPlaceholder")}</span>
          )}
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleLogoUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => logoInputRef.current?.click()}
          disabled={uploadingLogo}
        >
          {uploadingLogo ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {t("agentProfile.uploadLogo")}
        </Button>
        {errors.companyLogoUrl && (
          <p className="text-sm text-red-600 dark:text-red-400">{t("agentProfile.logoRequired")}</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
        <h3 className="font-semibold text-[#003366] dark:text-sky-300">
          {t("agentProfile.profilePhoto")}
        </h3>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div
            className={cn(
              "relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 bg-muted",
              errors.profileImageUrl ? "border-red-500" : "border-border"
            )}
          >
            {form.profileImageUrl ? (
              <img src={form.profileImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
                {t("agentProfile.photoPlaceholder")}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {t("agentProfile.uploadPhoto")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("agentProfile.photoHint")}</p>
            {errors.profileImageUrl && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("agentProfile.photoRequired")}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agent-first">{t("agentProfile.firstName")} *</Label>
          <Input
            id="agent-first"
            value={form.firstName}
            onChange={(e) => {
              setForm((f) => ({ ...f, firstName: e.target.value }));
              if (errors.firstName) setErrors((x) => ({ ...x, firstName: false }));
            }}
            className={cn(errors.firstName && "border-red-500")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-last">{t("agentProfile.lastName")} *</Label>
          <Input
            id="agent-last"
            value={form.lastName}
            onChange={(e) => {
              setForm((f) => ({ ...f, lastName: e.target.value }));
              if (errors.lastName) setErrors((x) => ({ ...x, lastName: false }));
            }}
            className={cn(errors.lastName && "border-red-500")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-title">{t("agentProfile.professionalTitle")}</Label>
        <Input
          id="agent-title"
          value={form.professionalTitle}
          onChange={(e) => setForm((f) => ({ ...f, professionalTitle: e.target.value }))}
          placeholder={DEFAULT_TITLE}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agent-phone">{t("agentProfile.phone")}</Label>
          <Input
            id="agent-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-email">{t("agentProfile.email")}</Label>
          <Input
            id="agent-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
      </div>

      <Button
        type="button"
        className="w-full bg-[#003366] text-white hover:bg-[#004080] hover:text-white dark:bg-[#003366] dark:text-white dark:hover:bg-[#004080] dark:hover:text-white"
        onClick={() => void handleSave()}
        disabled={saving || uploadingPhoto || uploadingLogo}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? t("agentProfile.saving") : t("agentProfile.save")}
      </Button>

      {message && <p className="text-center text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}