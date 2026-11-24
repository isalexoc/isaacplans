/**
 * CRM tags Lead Guard adds (GHL stores tags lowercase).
 *   web_verified — the lead came through the website's checks (every guarded path except a hold and
 *                  the quarantine fallback). GHL workflows that serve website leads can require it.
 *   web_released — Isaac released it from /admin/lead-holds after it was held.
 */
export const WEB_VERIFIED_TAG = "web_verified";
export const WEB_RELEASED_TAG = "web_released";
