/**
 * Response shapes for the CrankWheel RESTful API endpoints this app calls.
 *
 * Hand-written from the published OpenAPI spec and confirmed against live responses — the spec's
 * Postman export drops every request body, so it cannot be generated from.
 */

/** Which link was minted. The two behave differently enough that callers must branch on it. */
export type CrankwheelMeetingKind = "now" | "scheduled";

/** `POST /ss/api/make_noauth_link` */
export type NoauthLinkResponse = {
  url: string;
};

/** `POST /ss/api/schedule_meeting` */
export type ScheduledMeetingResponse = {
  url: string;
  uid: string;
  /** Newline-separated "Country: number" dial-in list. Only populated for conference audio. */
  numbers?: string;
};

/** One session from `GET /ss/api/usage_new`. */
export type CrankwheelUsageSession = {
  /** Presenter email — the only link back to who hosted it. */
  email: string;
  agent_name?: string;
  session_id: number;
  /** Seconds. */
  duration: number;
  start_date: string;
  end_date: string;
  /** Seconds of webcam use. */
  webcam_s?: number;
  session_ended?: boolean;
  viewer_info?: {
    viewer_count?: number;
    max_viewer_count?: number;
    /** Coarse geo strings like "Stafford, United States*". */
    locations?: string[];
  };
};

export type CrankwheelUsageResponse = {
  sessions?: CrankwheelUsageSession[];
};

/** Audio channel for a scheduled meeting. `call` = the agent phones the client (our default). */
export type CrankwheelAudio = "call" | "conference" | "web";
