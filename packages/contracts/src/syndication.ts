/**
 * @substrate-platform/contracts — Syndication & Web Feed Contracts.
 *
 * Universal contracts and Zod schemas for Web Syndication (RSS 2.0, Atom 1.0, and JSON Feed 1.1).
 * Completely agnostic of application domain or entity hierarchy.
 */

import { z } from 'zod';

export const FeedAuthorSchema = z.object({
  name: z.string().min(1, 'Author name is required'),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
  avatar: z.string().url().optional(),
});

export type FeedAuthor = z.infer<typeof FeedAuthorSchema>;
export type FeedAuthorInput = z.input<typeof FeedAuthorSchema>;

export const FeedEnclosureSchema = z.object({
  url: z.string().url('Enclosure URL must be a valid URL'),
  type: z.string().min(1, 'Enclosure MIME type is required'),
  length: z.number().int().nonnegative().optional(),
});

export type FeedEnclosure = z.infer<typeof FeedEnclosureSchema>;
export type FeedEnclosureInput = z.input<typeof FeedEnclosureSchema>;

export const FeedItemSchema = z.object({
  /** Stable unique identifier (maps to RSS guid / Atom id / JSON Feed id). */
  id: z.string().min(1, 'Feed item ID is required'),
  /** Headline / title. */
  title: z.string().min(1, 'Feed item title is required'),
  /** Canonical article/page permalink. */
  url: z.string().url('Feed item URL must be a valid URL'),
  /** Short plain-text summary or excerpt. */
  summary: z.string().optional(),
  /** Full HTML representation of the content. */
  content: z.string().optional(),
  /** Initial publication timestamp (ISO string or Date). */
  publishedAt: z.union([z.date(), z.string().datetime({ offset: true })]),
  /** Last modification timestamp (ISO string or Date). */
  updatedAt: z.union([z.date(), z.string().datetime({ offset: true })]).optional(),
  /** Per-item author override. */
  author: FeedAuthorSchema.optional(),
  /** Topic tags / categories. */
  tags: z.array(z.string()).optional(),
  /** Featured banner image URL. */
  image: z.string().url().optional(),
  /** Media attachment (podcast audio, video, etc.). */
  enclosure: FeedEnclosureSchema.optional(),
});

export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedItemInput = z.input<typeof FeedItemSchema>;

export const FeedChannelSchema = z.object({
  /** Channel or site title. */
  title: z.string().min(1, 'Channel title is required'),
  /** Channel subtitle or description. */
  description: z.string().min(1, 'Channel description is required'),
  /** Canonical home URL of the site. */
  siteUrl: z.string().url('Site URL must be a valid URL'),
  /** Self-referencing canonical URL of the feed document (required by Atom/RSS specs). */
  feedUrl: z.string().url('Feed URL must be a valid URL'),
  /** Language tag (e.g. "en", "zh-CN"). Defaults to "en". */
  language: z.string().default('en'),
  /** Copyright / rights notice. */
  copyright: z.string().optional(),
  /** Default feed author / publisher. */
  author: FeedAuthorSchema.optional(),
  /** Small square icon / favicon URL (PNG/ICO). */
  favicon: z.string().url().optional(),
  /** Large square feed artwork / logo URL. */
  icon: z.string().url().optional(),
  /** Last build or update timestamp of the feed. */
  updatedAt: z.union([z.date(), z.string().datetime({ offset: true })]).optional(),
  /** List of feed entries, typically ordered newest first. */
  items: z.array(FeedItemSchema).default([]),
});

export type FeedChannel = z.infer<typeof FeedChannelSchema>;
export type FeedChannelInput = z.input<typeof FeedChannelSchema>;
