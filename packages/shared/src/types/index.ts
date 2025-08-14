// Enhanced NPS Analytics Types
import { z } from "zod";

// Base schemas
export const NpsResponseSchema = z.object({
  id: z.string().optional(),
  rating: z.number().min(0).max(10),
  comment: z.string().optional(),
  date: z.string(),
  platform: z.string().optional(),
  language: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  themes: z.array(z.string()).optional(),
  cluster_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const TopicMentionSchema = z.object({
  id: z.string().optional(),
  response_id: z.string(),
  topic: z.string(),
  confidence: z.number().min(0).max(1),
  created_at: z.string().optional()
});

export const DataSyncStateSchema = z.object({
  id: z.string().optional(),
  last_sync: z.string(),
  status: z.enum(['syncing', 'completed', 'error']),
  message: z.string().optional(),
  created_at: z.string().optional()
});

// API Request/Response schemas
export const UploadPreviewRequestSchema = z.object({
  file: z.instanceof(File).optional(),
  preview_rows: z.number().min(1).max(100).default(10)
});

export const UploadPreviewResponseSchema = z.object({
  preview: z.array(NpsResponseSchema),
  total_rows: z.number(),
  validation_errors: z.array(z.string()),
  session_id: z.string()
});

export const UploadCommitRequestSchema = z.object({
  session_id: z.string(),
  overwrite_existing: z.boolean().default(false)
});

export const UploadCommitResponseSchema = z.object({
  success: z.boolean(),
  imported_count: z.number(),
  skipped_count: z.number(),
  errors: z.array(z.string())
});

// Statistics schemas
export const NpsStatsSchema = z.object({
  period: z.string(),
  nps_score: z.number(),
  total_responses: z.number(),
  promoters: z.number(),
  passives: z.number(),
  detractors: z.number(),
  date: z.string()
});

export const SentimentDistributionSchema = z.object({
  positive: z.number(),
  neutral: z.number(),  
  negative: z.number(),
  total: z.number()
});

export const TopicSchema = z.object({
  topic: z.string(),
  count: z.number(),
  percentage: z.number(),
  sentiment_breakdown: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number()
  })
});

// Pagination schemas
export const PaginationRequestSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  sort_by: z.enum(['date', 'rating', 'created_at']).default('date'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export const PaginatedResponseSchema = z.object({
  data: z.array(z.any()),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
  total: z.number().optional()
});

// Analysis schemas
export const AnalysisBatchRequestSchema = z.object({
  response_ids: z.array(z.string()).optional(),
  force_reanalysis: z.boolean().default(false),
  include_sentiment: z.boolean().default(true),
  include_topics: z.boolean().default(true),
  include_clustering: z.boolean().default(true)
});

export const AnalysisBatchResponseSchema = z.object({
  job_id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  processed_count: z.number(),
  total_count: z.number(),
  estimated_completion: z.string().optional()
});

// Type exports
export type NpsResponse = z.infer<typeof NpsResponseSchema>;
export type TopicMention = z.infer<typeof TopicMentionSchema>;
export type DataSyncState = z.infer<typeof DataSyncStateSchema>;

export type UploadPreviewRequest = z.infer<typeof UploadPreviewRequestSchema>;
export type UploadPreviewResponse = z.infer<typeof UploadPreviewResponseSchema>;
export type UploadCommitRequest = z.infer<typeof UploadCommitRequestSchema>;
export type UploadCommitResponse = z.infer<typeof UploadCommitResponseSchema>;

export type NpsStats = z.infer<typeof NpsStatsSchema>;
export type SentimentDistribution = z.infer<typeof SentimentDistributionSchema>;
export type Topic = z.infer<typeof TopicSchema>;

export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;
export type PaginatedResponse<T = any> = Omit<z.infer<typeof PaginatedResponseSchema>, 'data'> & { data: T[] };

export type AnalysisBatchRequest = z.infer<typeof AnalysisBatchRequestSchema>;
export type AnalysisBatchResponse = z.infer<typeof AnalysisBatchResponseSchema>;

// Legacy compatibility - keeping your existing exports
export const insertNpsResponseSchema = NpsResponseSchema;
export type InsertNpsResponse = NpsResponse;
export type User = any;
export type InsertUser = any;
export type InsertTopicMention = TopicMention;
export type InsertDataSyncState = DataSyncState;

// Legacy table exports for existing code compatibility
export const users = {};
export const npsResponses = {};
export const topicMentions = {};
export const dataSyncState = {};
