# Consumer Guides Setup Guide

## ✅ What's Been Implemented

### Database Setup
- ✅ Drizzle ORM schema with 3 tables: `guides`, `guide_unlocks`, `guide_analytics`
- ✅ Database connection file (`lib/db/index.ts`)
- ✅ Drizzle config file (`drizzle.config.ts`)

### API Routes
- ✅ `/api/guides` - Fetch all guides (with optional category filter)
- ✅ `/api/unlock-guide` - Unlock a guide after form submission
- ✅ `/api/check-guide-unlock` - Check if user has unlocked a guide
- ✅ `/api/guide-analytics` - Track guide views, downloads, unlock attempts

### Components
- ✅ `GuideUnlockModal` - Modal that shows category-specific forms
- ✅ `GuideCard` - Individual guide card with lock/unlock states
- ✅ `ConsumerGuidesClient` - Main page component with category tabs
- ✅ `ConsumerGuidesPage` - Server component with SEO metadata

### Translations
- ✅ English translations (`messages/en/consumer-guides.json`)
- ✅ Spanish translations (`messages/es/consumer-guides.json`)

### Routing & Navigation
- ✅ Added `/consumer-guides` route (English) and `/guias-para-consumidores` (Spanish)
- ✅ Updated header navigation
- ✅ Added to sitemap

## 🚀 Next Steps

### 1. Install Dependencies
```bash
npm install drizzle-orm@^0.29.0 @neondatabase/serverless@^0.9.0 drizzle-kit@^0.20.0 --legacy-peer-deps
```

### 2. Set Up Environment Variables
Make sure your `.env.local` file has:
```
DATABASE_URL=postgresql://neondb_owner:npg_zAsPNO0tYBZ7@ep-patient-pond-ahz2wsix-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Generate and Run Database Migrations
```bash
npm run db:generate  # Generates migration files
npm run db:migrate   # Applies migrations to database
```

### 4. Add Guides to Database
You'll need to insert guides into the database. You can do this via:
- SQL directly in Neon dashboard
- Drizzle Studio: `npm run db:studio`
- API endpoint (create `/api/admin/guides` for admin use)

Example SQL to insert a guide:
```sql
INSERT INTO guides (id, category, title, title_es, description, description_es, thumbnail, pdf_url, "order", active)
VALUES (
  'aca-guide-1',
  'aca',
  'Complete Guide to ACA Open Enrollment',
  'Guía Completa de Inscripción Abierta ACA',
  'Everything you need to know about enrolling in ACA health insurance...',
  'Todo lo que necesita saber sobre inscribirse en el seguro de salud ACA...',
  'guide_aca_1',  -- Cloudinary public ID
  'guides/aca/complete-guide-open-enrollment.pdf',  -- Cloudinary PDF path
  0,
  true
);
```

### 5. Upload PDFs to Cloudinary
- Upload your guide PDFs to Cloudinary
- Use the public ID or full URL in the `pdf_url` field
- Upload thumbnails/images for each guide

### 6. Form Submission Detection
The current implementation listens for `postMessage` from AgentCRM forms. You may need to:

**Option A: Use AgentCRM Webhooks**
- Set up webhooks in AgentCRM to call your API when forms are submitted
- Include guideId in the webhook payload

**Option B: Add Hidden Field to Forms**
- Add a hidden field `guideId` to each AgentCRM form
- Extract it from the form submission

**Option C: Manual Unlock Button**
- After form submission, show a "Continue to Guide" button
- User clicks to unlock (you already have their info from the form)

### 7. Testing
1. Test guide unlocking flow
2. Test analytics tracking
3. Test category filtering
4. Test unlock persistence (cookies + database)

## 📝 Important Notes

1. **Form Submission**: The current postMessage listener may need adjustment based on how AgentCRM actually sends messages. Test and adjust as needed.

2. **User Identification**: Currently uses email/phone from form. You may want to store a session ID or use cookies more extensively.

3. **Analytics**: All events are tracked. You can build an admin dashboard later to view:
   - Most popular guides
   - Unlock conversion rates
   - Source/campaign performance

4. **Meta Ads Integration**: The page automatically captures `utm_source` and `utm_campaign` from URL params for tracking.

5. **PDF Storage**: Make sure PDFs are publicly accessible in Cloudinary or use signed URLs.

## 🎨 Customization

- Add more guides by inserting into the database
- Customize guide card design in `components/guide-card.tsx`
- Adjust category colors in `components/consumer-guides-client.tsx`
- Add more analytics events as needed

## 🔒 Security Notes

- API routes should validate inputs
- Consider rate limiting for unlock attempts
- Add authentication for admin analytics endpoint
- Sanitize user inputs before database queries

