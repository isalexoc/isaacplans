# HeyGen AI Presenter Setup

The Social Media Studio can render AI YouTube Shorts with an optional **HeyGen AI presenter** in the
corner (Type C: presenter inset + AI scene images + karaoke captions filling the frame). It's a per-render
toggle — with it **off**, Shorts render exactly as before (faceless: images + ElevenLabs voiceover + captions
+ music). With it **on**, a HeyGen avatar speaks the narration, lip-synced and bilingual (EN/ES).

Start with a **stock avatar** to validate everything; swap in a custom **digital twin of Isaac** later by
changing one env var.

## How it works

1. When the toggle is on, the studio first asks HeyGen to render the full narration as an avatar clip on a
   **solid green background** (`POST /v2/video/generate`), then polls until it's ready.
2. The green clip is composited into the corner of the Short by JSON2Video, which **chroma-keys** the green
   out so only the presenter shows.
3. The HeyGen clip is the **master audio** for the Short (the per-scene ElevenLabs voiceover is skipped to
   avoid double audio); captions auto-transcribe the presenter's speech.

Because HeyGen renders take longer than Vercel's serverless limit, the presenter render runs as its own
submit-then-poll phase on the client, before the JSON2Video compose step.

## Environment variables

Add these to `.env` (and to Vercel project settings for production):

| Var | Required | Description |
|-----|----------|-------------|
| `HEYGEN_API_KEY` | ✅ (already set) | HeyGen API key. |
| `HEYGEN_AVATAR_ID` | ✅ | Avatar used for English (and the fallback for Spanish). A stock avatar id now; your Isaac twin's id later. |
| `HEYGEN_VOICE_ID_EN` | ✅ | HeyGen voice id for English narration. |
| `HEYGEN_AVATAR_ID_ES` | optional | Separate avatar for Spanish. Falls back to `HEYGEN_AVATAR_ID` if unset (same avatar lip-syncs Spanish fine). |
| `HEYGEN_VOICE_ID_ES` | optional | Spanish voice id. Falls back to `HEYGEN_VOICE_ID_EN` if unset. |
| `HEYGEN_BACKGROUND_COLOR` | optional | Chroma-key color (default `#00FF00`). Change only if an avatar's wardrobe clashes with green. |

If `HEYGEN_API_KEY`, the avatar id, or the voice id is missing, turning the toggle on surfaces a clear error
in the studio — just toggle it off to render faceless. The faceless path never depends on HeyGen.

## Getting the IDs

1. **API key** — HeyGen dashboard → Settings → API. (Custom avatars/API access are gated by plan tier.)
2. **Stock avatar id** — list available avatars:
   ```bash
   curl -s https://api.heygen.com/v2/avatars -H "x-api-key: $HEYGEN_API_KEY"
   ```
   Pick a business-looking presenter and copy its `avatar_id` into `HEYGEN_AVATAR_ID`.
3. **Voice id** — list voices (`GET https://api.heygen.com/v2/voices`) and copy a `voice_id`. You can connect
   your **ElevenLabs** account inside HeyGen so your existing Isaac voice appears as a selectable HeyGen voice —
   that keeps the voice consistent across presenter and faceless Shorts.

## Swapping in your custom Isaac twin later

1. Create the avatar in HeyGen (Instant Avatar from ~2 min of footage, or a Studio Avatar from studio footage)
   and complete the consent video.
2. When it finishes processing, copy its `avatar_id`.
3. Set `HEYGEN_AVATAR_ID` (and optionally `HEYGEN_AVATAR_ID_ES`) to that id. No code change needed.

## Future enhancements (out of scope for now)

- **Per-scene HeyGen clips** for beat-matched image timing (today one clip drives the whole Short, with scene
  image durations word-count-weighted to roughly track the narration).
- **Transparent webm** output instead of green-screen chroma-key.
