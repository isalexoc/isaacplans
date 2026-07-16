export type LeaveBehindImageKind = "profile_photo" | "company_logo";

/** Root folder in Cloudinary Media Library for leave-behind agent assets. */
export const LEAVE_BEHIND_CLOUDINARY_ROOT_FOLDER = "isaacplans";

/** Upload path: isaacplans/leave-behind-agents/{userId}/photos|logos */
export function leaveBehindAgentUploadFolder(
  userId: string,
  kind: LeaveBehindImageKind
): string {
  const subfolder = kind === "profile_photo" ? "photos" : "logos";
  return `${LEAVE_BEHIND_CLOUDINARY_ROOT_FOLDER}/leave-behind-agents/${userId}/${subfolder}`;
}

function cloudName(): string {
  const name =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
  if (!name) throw new Error("Cloudinary cloud name is not configured");
  return name;
}

/** Transformation path segments (Cloudinary URL API). Logos are delivered as
 * uploaded — the background-removal option was retired; agents upload final logos. */
export function leaveBehindTransformationPath(kind: LeaveBehindImageKind): string {
  if (kind === "profile_photo") {
    return "e_improve/c_fill,g_face,w_400,h_400/q_auto:good/f_auto";
  }
  return "c_limit,w_560,h_160/e_sharpen:80/q_auto:good/f_auto";
}

export function leaveBehindDeliveryUrl(
  publicId: string,
  kind: LeaveBehindImageKind
): string {
  const transforms = leaveBehindTransformationPath(kind);
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${transforms}/${publicId}`;
}
