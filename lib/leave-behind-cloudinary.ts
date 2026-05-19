export type LeaveBehindImageKind = "profile_photo" | "company_logo";

function cloudName(): string {
  const name =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
  if (!name) throw new Error("Cloudinary cloud name is not configured");
  return name;
}

/** Transformation path segments (Cloudinary URL API). */
export function leaveBehindTransformationPath(
  kind: LeaveBehindImageKind,
  options?: { removeLogoBackground?: boolean }
): string {
  if (kind === "profile_photo") {
    return "e_improve/c_fill,g_face,w_400,h_400/q_auto:good/f_auto";
  }
  if (options?.removeLogoBackground !== false) {
    return "e_background_removal/f_png/c_limit,w_560,h_160/e_sharpen:80/q_auto:best/f_auto";
  }
  return "c_limit,w_560,h_160/e_sharpen:80/q_auto:good/f_auto";
}

export function leaveBehindDeliveryUrl(
  publicId: string,
  kind: LeaveBehindImageKind,
  options?: { removeLogoBackground?: boolean }
): string {
  const transforms = leaveBehindTransformationPath(kind, options);
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${transforms}/${publicId}`;
}
