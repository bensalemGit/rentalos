ALTER TABLE public_links
ADD COLUMN IF NOT EXISTS guarantee_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_public_links_guarantee_id
ON public_links(guarantee_id);