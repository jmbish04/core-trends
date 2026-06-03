/**
 * @fileoverview Database schema definitions using drizzle-orm.
 *
 * This file defines the database schema using drizzle-orm for the complete application.
 * Single-user system - authentication via WORKER_API_KEY only.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Authentication removed - using WORKER_API_KEY for API authentication
// Single user system - no per-user tables needed

/**
 * Dashboard metrics table
 */
export const dashboardMetrics = sqliteTable("dashboard_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  metricName: text("metric_name").notNull(),
  metricValue: real("metric_value").notNull(),
  metricType: text("metric_type").notNull(), // 'count', 'percentage', 'currency', 'time'
  category: text("category").notNull(), // 'users', 'revenue', 'performance', 'system'
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * AI Thread table for assistant conversations
 */
export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Messages table for thread conversations
 */
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON string for attachments, tool calls, etc.
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * System health checks table
 */
export const healthChecks = sqliteTable("health_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceName: text("service_name").notNull(),
  status: text("status").notNull(), // 'healthy', 'degraded', 'down'
  responseTime: integer("response_time"), // in milliseconds
  errorMessage: text("error_message"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Notifications table for system alerts
 */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'success'
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * PlateJS documents table
 */
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  content: text("content").notNull(), // JSON string of Slate nodes
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Repositories table for tracked GitHub repositories
 */
export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: integer("github_id").notNull().unique(),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  language: text("language").notNull(),
  stars: integer("stars").notNull(),
  trendPeriod: text("trend_period").notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  isNewTrending: integer("is_new_trending", { mode: "boolean" })
    .notNull()
    .default(true),
  isStarredByUser: integer("is_starred_by_user", { mode: "boolean" })
    .notNull()
    .default(false),
  discoveredMethod: text("discovered_method").notNull(), // 'pipeline_trending' | 'agent_search' | 'webhook_signal'
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Goals for repository discovery
 */
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targetKeywords: text("target_keywords", { mode: "json" }).$type<string[]>().notNull(),
  targetLanguages: text("target_languages", { mode: "json" }).$type<string[]>().notNull(),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Repository evaluations from AI agent
 */
export const evaluations = sqliteTable("evaluations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repositoryId: integer("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  score: integer("score").notNull(), // Range 1 to 10
  rationale: text("rationale").notNull(),
  compatibilityFlags: text("compatibility_flags"), // JSON object
  isAbandonedProject: integer("is_abandoned_project", { mode: "boolean" })
    .notNull()
    .default(false),
  surveyResponse: text("survey_response"), // User feedback on evaluation
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Projects generated from repositories
 */
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  generatedRepoUrl: text("generated_repo_url"),
  contextData: text("context_data"), // JSON object with metadata
  status: text("status").notNull().default("initiated"), // 'initiated' | 'scaffolded' | 'active'
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * System logs for monitoring
 */
export const systemLogs = sqliteTable("system_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  level: text("level").notNull(), // 'info' | 'warn' | 'error'
  subsystem: text("subsystem").notNull(), // 'webhook_listener' | 'agent_evaluator' | 'frontend' | 'github_action'
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Pipeline runs from GitHub Actions
 * Stores data sent from the repository intelligence pipeline
 */
export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(), // GitHub Actions run ID
  status: text("status").notNull(), // 'success' | 'failure' | 'running'
  repositoriesProcessed: integer("repositories_processed").notNull().default(0),
  originalPayload: text("original_payload"), // JSON string of original GitHub API response
  enrichedData: text("enriched_data"), // JSON string of AI-enriched analysis
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});
