-- FTS index on articles (title || excerpt || body)
CREATE INDEX IF NOT EXISTS "articles_fts_idx"
  ON "articles"
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, '')));--> statement-breakpoint
-- GIN index on tags arrays
CREATE INDEX IF NOT EXISTS "articles_tags_idx" ON "articles" USING gin("tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_tags_idx" ON "projects" USING gin("tags");--> statement-breakpoint
-- ivfflat index for vector similarity search
CREATE INDEX IF NOT EXISTS "articles_embedding_idx"
  ON "articles" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);--> statement-breakpoint
-- Additional btree indexes
CREATE INDEX IF NOT EXISTS "articles_status_idx" ON "articles" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_created_at_idx" ON "articles" ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experiments_created_at_idx" ON "experiments" ("created_at" DESC);--> statement-breakpoint
-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
-- Triggers for auto-updating updated_at
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON "articles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();--> statement-breakpoint
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON "projects"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();--> statement-breakpoint
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON "notes"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
