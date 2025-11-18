// 데이터베이스 스키마 정의
// LLD 문서의 ERD를 기반으로 작성

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  bigserial,
  bigint,
} from "drizzle-orm/pg-core";

// 사용자 테이블
export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  authProvider: varchar("auth_provider", { length: 50 }).default("local"),
  profileImageUrl: text("profile_image_url"),
  tier: varchar("tier", { length: 20 }).default("free"), // free, pro, enterprise
  apiQuotaUsed: integer("api_quota_used").default(0),
  apiQuotaLimit: integer("api_quota_limit").default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// 템플릿 테이블
export const templates = pgTable("templates", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  promptTemplate: text("prompt_template").notNull(),
  minChars: integer("min_chars").default(10),
  maxChars: integer("max_chars").default(150),
  tone: varchar("tone", { length: 50 }), // casual, formal, urgent, humorous
  category: varchar("category", { length: 100 }), // 이커머스, SaaS, 부동산 등
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// 카피 테이블
export const copies = pgTable("copies", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  templateId: bigint("template_id", { mode: "number" })
    .references(() => templates.id, { onDelete: "set null" }),
  prompt: text("prompt").notNull(), // 사용자 입력 프롬프트
  generatedContent: text("generated_content").notNull(), // AI 생성 결과
  charCount: integer("char_count").notNull(),
  minChars: integer("min_chars").default(10).notNull(),
  maxChars: integer("max_chars").default(150).notNull(),
  tone: varchar("tone", { length: 50 }), // casual, formal, urgent, humorous
  language: varchar("language", { length: 10 }).default("ko-KR"),
  modelUsed: varchar("model_used", { length: 50 }).default("gpt-5"),
  status: varchar("status", { length: 20 }).default("success"), // success, failed, pending
  isBookmarked: boolean("is_bookmarked").default(false),
  folderName: varchar("folder_name", { length: 100 }),
  generationTimeMs: integer("generation_time_ms"), // 생성 소요 시간
  apiCost: decimal("api_cost", { precision: 10, scale: 6 }), // API 비용 기록
  metadata: jsonb("metadata"), // 추가 정보
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// 대화 세션
export const conversationSessions = pgTable("conversation_sessions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  preferredModel: varchar("preferred_model", { length: 50 }),
  recommendedModel: varchar("recommended_model", { length: 50 }),
  status: varchar("status", { length: 20 }).default("draft"),
  context: jsonb("context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationTurns = pgTable("conversation_turns", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" })
    .references(() => conversationSessions.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 10 }).notNull(), // user, assistant, system
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 분석 테이블
export const analytics = pgTable("analytics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  date: timestamp("date").notNull(),
  copiesGenerated: integer("copies_generated").default(0),
  successfulCopies: integer("successful_copies").default(0),
  failedCopies: integer("failed_copies").default(0),
  apiCalls: integer("api_calls").default(0),
  avgGenerationTimeMs: integer("avg_generation_time_ms"),
  totalApiCost: decimal("total_api_cost", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 모델 사용 로그
export const modelUsageLogs = pgTable("model_usage_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: bigint("session_id", { mode: "number" })
    .references(() => conversationSessions.id, { onDelete: "set null" }),
  copyId: bigint("copy_id", { mode: "number" })
    .references(() => copies.id, { onDelete: "set null" }),
  modelName: varchar("model_name", { length: 50 }).notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  cost: decimal("cost", { precision: 10, scale: 6 }).default("0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 광고 레퍼런스 테이블
export const adReferences = pgTable("ad_references", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  platform: varchar("platform", { length: 50 }).notNull(),
  adCopy: text("ad_copy").notNull(),
  headline: text("headline"),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  targetAudience: varchar("target_audience", { length: 100 }),
  brand: varchar("brand", { length: 100 }),
  keywords: text("keywords").array(),
  copywritingFormula: varchar("copywriting_formula", { length: 50 }),
  psychologicalTriggers: text("psychological_triggers").array(),
  tone: varchar("tone", { length: 50 }),
  charCount: integer("char_count"),
  performanceScore: decimal("performance_score", { precision: 3, scale: 2 }).default("0.50"),
  qualityRating: integer("quality_rating").default(0),
  usageCount: integer("usage_count").default(0),
  successCount: integer("success_count").default(0),
  sourceUrl: text("source_url"),
  collectedVia: varchar("collected_via", { length: 50 }),
  collectedAt: timestamp("collected_at").defaultNow(),
  status: varchar("status", { length: 20 }).default("active"),
  isPremium: boolean("is_premium").default(false),
  isSelected: boolean("is_selected").default(false), // 사용자가 체크한 레퍼런스 (카피 생성 시 우선 사용)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 카피 피드백 테이블
export const copyFeedback = pgTable("copy_feedback", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  copyId: bigint("copy_id", { mode: "number" })
    .references(() => copies.id, { onDelete: "cascade" })
    .notNull(),
  userId: bigint("user_id", { mode: "number" })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  rating: integer("rating").notNull(),
  isFavorite: boolean("is_favorite").default(false),
  isUsed: boolean("is_used").default(false),
  feedbackText: text("feedback_text"),
  feedbackTags: text("feedback_tags").array(),
  actualCtr: decimal("actual_ctr", { precision: 5, scale: 4 }),
  actualConversionRate: decimal("actual_conversion_rate", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Few-shot 학습 로그
export const fewshotLearningLog = pgTable("fewshot_learning_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  copyId: bigint("copy_id", { mode: "number" })
    .references(() => copies.id, { onDelete: "cascade" })
    .notNull(),
  adReferenceId: bigint("ad_reference_id", { mode: "number" })
    .references(() => adReferences.id, { onDelete: "cascade" })
    .notNull(),
  resultQuality: decimal("result_quality", { precision: 3, scale: 2 }),
  userSatisfaction: integer("user_satisfaction"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 광고 수집 통계
export const adCollectionStats = pgTable("ad_collection_stats", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  collectionSessionId: varchar("collection_session_id", { length: 100 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }),
  totalCollected: integer("total_collected").default(0),
  totalSaved: integer("total_saved").default(0),
  totalDuplicates: integer("total_duplicates").default(0),
  totalErrors: integer("total_errors").default(0),
  collectedAt: timestamp("collected_at").defaultNow(),
  durationMs: integer("duration_ms"),
});

// 타입 추출 (TypeScript 타입으로 사용)
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Copy = typeof copies.$inferSelect;
export type NewCopy = typeof copies.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Analytic = typeof analytics.$inferSelect;
export type NewAnalytic = typeof analytics.$inferInsert;
export type ConversationSession = typeof conversationSessions.$inferSelect;
export type NewConversationSession =
  typeof conversationSessions.$inferInsert;
export type ConversationTurn = typeof conversationTurns.$inferSelect;
export type NewConversationTurn = typeof conversationTurns.$inferInsert;
export type ModelUsageLog = typeof modelUsageLogs.$inferSelect;
export type NewModelUsageLog = typeof modelUsageLogs.$inferInsert;
export type AdReference = typeof adReferences.$inferSelect;
export type NewAdReference = typeof adReferences.$inferInsert;
export type CopyFeedback = typeof copyFeedback.$inferSelect;
export type NewCopyFeedback = typeof copyFeedback.$inferInsert;
export type FewshotLearningLog = typeof fewshotLearningLog.$inferSelect;
export type NewFewshotLearningLog = typeof fewshotLearningLog.$inferInsert;
export type AdCollectionStat = typeof adCollectionStats.$inferSelect;
export type NewAdCollectionStat = typeof adCollectionStats.$inferInsert;

