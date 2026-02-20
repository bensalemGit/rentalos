ALTER TABLE public_links
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_public_links_consumed_at
  ON public_links(consumed_at);