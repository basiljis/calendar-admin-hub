ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS system_logs_resolved_idx ON public.system_logs (resolved) WHERE NOT resolved;