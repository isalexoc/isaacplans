# Meta Conversions API (CAPI) Setup Guide

## Overview

This implementation sends server-side events to Meta for better attribution and deduplication. When a user submits a form, both the browser Pixel and server-side CAPI send the same event with matching `eventID`/`event_id`, allowing Meta to deduplicate and improve attribution accuracy.

## Architecture

- **Browser Pixel**: Fast UI-side tracking + remarketing
- **CAPI**: Server-side backup for attribution when browsers/extensions block the pixel
- **Deduplication**: Same `eventID` sent from both sides (Pixel `eventID` ↔️ CAPI `event_id`)

## Environment Variables Required

Add these to your `.env.local`:

```bash
# Facebook Pixel ID (already set)
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=866476789191859

# Meta Conversions API Access Token
# Get this from: Meta Events Manager → Settings → Conversions API → Generate Access Token
META_CAPI_ACCESS_TOKEN=your_access_token_here

# Optional: Test Event Code (for testing in Events Manager)
# Get this from: Meta Events Manager → Test Events → Test Event Code
META_TEST_EVENT_CODE=TEST12345
```

## How It Works

### 1. Form Submission Flow

When a user submits the IUL lead-gen form:

1. **Client generates event ID** (before API call)
2. **Client fires Pixel event** with `eventID`
3. **Client sends API request** with `eventID`, `fbp`, `fbc`, and `eventSourceUrl` in `meta` object
4. **Server receives request** and creates contact in Agent CRM
5. **Server sends CAPI event** with matching `event_id` (same as Pixel `eventID`)

### 2. Deduplication

Meta automatically deduplicates events when:
- Pixel `eventID` matches CAPI `event_id`
- Events occur within 48 hours of each other
- User data matches (hashed email/phone)

## Implementation Details

### Client-Side (Form)

```typescript
// Generate event ID
const eventId = generateEventId();

// Get Facebook cookies
const { fbp, fbc } = getFacebookCookies();

// Fire Pixel event with eventID
trackLead(
  { contentName: "IUL Lead Generation Campaign", value: 100 },
  userData,
  eventId // Pass eventID for deduplication
);

// Send to API with metadata
await fetch("/api/create-contact", {
  body: JSON.stringify({
    // ... form data
    meta: {
      eventId,
      fbp,
      fbc,
      eventSourceUrl: window.location.href,
    },
  }),
});
```

### Server-Side (API Route)

The `/api/create-contact` route:
1. Creates contact in Agent CRM
2. Sends CAPI event with:
   - Matching `event_id` (from `meta.eventId`)
   - Hashed PII (email, phone, names)
   - User agent and IP
   - Facebook cookies (`fbp`, `fbc`)
   - Custom data (content_name, value, currency)

## Testing

### 1. Test Events Tool (Recommended for CAPI)

1. Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Select your pixel
3. Go to **Test Events** tab
4. Set `META_TEST_EVENT_CODE` in your `.env.local`
5. Submit the form
6. You should see the event appear in Test Events within seconds

### 2. Events Manager

1. Go to Events Manager → Overview
2. Submit the form
3. Events should appear within 15-60 minutes
4. Look for "Lead" events from both Pixel and CAPI

### 3. Network Tab

1. Open DevTools → Network
2. Filter by "facebook" or "graph.facebook.com"
3. Submit the form
4. You should see:
   - Browser: Request to `facebook.com/tr` (Pixel)
   - Server: Request to `graph.facebook.com/v21.0/{pixelId}/events` (CAPI)

## Important Notes

### Data Sharing Restrictions

Your site is categorized as "Financial service", which means:
- Some custom parameters may be restricted
- URL parameters may be stripped
- Standard events (Lead, PageView) still work fine

### PII Hashing

Meta requires all PII to be SHA-256 hashed:
- ✅ Email: `sha256(lowercase(email))`
- ✅ Phone: `sha256(digits_only(phone))`
- ✅ Names: `sha256(lowercase(name))`

The CAPI helper automatically handles this.

### Event Timing

- Pixel events fire immediately (client-side)
- CAPI events fire after form submission (server-side)
- Meta deduplicates within 48 hours

### Error Handling

CAPI errors are logged but **non-blocking**:
- If CAPI fails, the form submission still succeeds
- CAPI is a backup - Pixel is primary
- Check server logs for CAPI errors

## Troubleshooting

### Events Not Appearing

1. **Check environment variables**:
   ```bash
   echo $META_CAPI_ACCESS_TOKEN
   ```

2. **Check server logs** for CAPI errors

3. **Verify event ID matching**:
   - Pixel `eventID` must match CAPI `event_id`
   - Check browser console for Pixel eventID
   - Check server logs for CAPI event_id

4. **Test with Test Event Code**:
   - Set `META_TEST_EVENT_CODE` in `.env.local`
   - Submit form
   - Check Test Events in Events Manager

### Common Issues

**"Invalid access token"**
- Regenerate access token in Events Manager
- Make sure token has `ads_management` permission

**"Event ID already used"**
- Event IDs must be unique
- If testing, wait a few minutes or generate new IDs

**"Missing required parameter"**
- Check that `action_source`, `event_source_url`, `user_data` are all present
- Verify `client_user_agent` is being sent

## Next Steps

1. ✅ Set `META_CAPI_ACCESS_TOKEN` in `.env.local`
2. ✅ Test with Test Event Code
3. ✅ Verify events in Events Manager
4. ✅ Monitor for 24-48 hours to see deduplication

## Additional Events

To add CAPI for other events (CompleteRegistration, Subscribe, etc.):

1. Generate event ID on client
2. Fire Pixel event with `eventID`
3. Send `eventID` to your API endpoint
4. Call `sendMetaCapiEvent()` in your API route

See `lib/meta-capi.ts` for the helper function.

