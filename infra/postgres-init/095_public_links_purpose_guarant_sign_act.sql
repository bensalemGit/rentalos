-- 095_public_links_purpose_guarant_sign_act.sql
-- Add purpose for guarantor signature link

ALTER TYPE public.public_link_purpose
ADD VALUE IF NOT EXISTS 'GUARANT_SIGN_ACT';