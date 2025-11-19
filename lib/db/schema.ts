import { pgTable, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";

// Guides table - stores all available guides
export const guides = pgTable("guides", {
  id: text("id").primaryKey(),
  category: text("category").notNull(), // 'aca' | 'shortTerm' | 'dentalVision' | 'hospitalIndemnity' | 'iul' | 'finalExpense'
  title: text("title").notNull(),
  titleEs: text("title_es"), // Spanish title
  description: text("description").notNull(),
  descriptionEs: text("description_es"), // Spanish description
  thumbnail: text("thumbnail").notNull(), // Cloudinary public ID
  pdfUrl: text("pdf_url").notNull(), // Cloudinary PDF public ID or URL
  order: integer("order").default(0).notNull(), // For sorting within category
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("category_idx").on(table.category),
  activeIdx: index("active_idx").on(table.active),
}));

// Guide unlocks table - tracks which users unlocked which guides
export const guideUnlocks = pgTable("guide_unlocks", {
  id: text("id").primaryKey(), // UUID or composite key
  guideId: text("guide_id").notNull().references(() => guides.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  source: text("source"), // 'meta_ads', 'organic', 'direct', etc.
  campaign: text("campaign"), // Campaign name if from ads
}, (table) => ({
  guideIdIdx: index("guide_id_idx").on(table.guideId),
  emailIdx: index("email_idx").on(table.email),
  phoneIdx: index("phone_idx").on(table.phone),
  guideEmailIdx: index("guide_email_idx").on(table.guideId, table.email),
  guidePhoneIdx: index("guide_phone_idx").on(table.guideId, table.phone),
}));

// Analytics table - for tracking guide views/downloads
export const guideAnalytics = pgTable("guide_analytics", {
  id: text("id").primaryKey(),
  guideId: text("guide_id").notNull().references(() => guides.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'view', 'download', 'unlock_attempt'
  email: text("email"),
  phone: text("phone"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  referrer: text("referrer"),
  source: text("source"),
  campaign: text("campaign"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  guideIdIdx: index("analytics_guide_id_idx").on(table.guideId),
  eventTypeIdx: index("analytics_event_type_idx").on(table.eventType),
  createdAtIdx: index("analytics_created_at_idx").on(table.createdAt),
}));

