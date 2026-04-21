-- 103_public_links_purpose_landlord_sign_guarantee_act.sql
-- Add purpose for landlord signature link on guarantee act

ALTER TYPE public.public_link_purpose
ADD VALUE IF NOT EXISTS 'LANDLORD_SIGN_GUARANTEE_ACT';