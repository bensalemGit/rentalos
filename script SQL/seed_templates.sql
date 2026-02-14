BEGIN;

-- ============================================================
-- 0) Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) Tables variantes (EDL + Inventaire)
-- ============================================================

CREATE TABLE IF NOT EXISTS unit_template_edl_variant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES unit_templates(id) ON DELETE CASCADE,
  variant_code text NOT NULL,
  section text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS unit_template_inventory_variant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES unit_templates(id) ON DELETE CASCADE,
  variant_code text NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  default_qty integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0
);

-- Unicité anti-doublons (variantes)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tpl_edl_variant_unique
ON unit_template_edl_variant_items(template_id, variant_code, section, label);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tpl_inv_variant_unique
ON unit_template_inventory_variant_items(template_id, variant_code, category, name, unit);

-- Unicité base (tu les as déjà mais safe)
CREATE UNIQUE INDEX IF NOT EXISTS ux_template_edl_unique
ON unit_template_edl_items(template_id, section, label);

CREATE UNIQUE INDEX IF NOT EXISTS ux_template_inv_unique
ON unit_template_inventory_items(template_id, category, name, unit);

-- ============================================================
-- 2) Upsert des 5 templates (rooms_count + label requis)
-- ============================================================
-- NOTE: ton schema impose rooms_count NOT NULL + label NOT NULL
WITH wanted AS (
  SELECT * FROM (VALUES
    ('studio'::text, 0::int, 1::int, false::bool, 'Studio'::text),
    ('t1'    ::text, 1::int, 2::int, false::bool, 'T1'::text),
    ('t2'    ::text, 1::int, 2::int, false::bool, 'T2'::text),
    ('t3'    ::text, 2::int, 3::int, false::bool, 'T3'::text),
    ('t4'    ::text, 3::int, 4::int, false::bool, 'T4'::text)
  ) v(code, bedrooms_count, rooms_count, is_duplex, label)
),
upserted AS (
  INSERT INTO unit_templates (code, bedrooms_count, rooms_count, is_duplex, label)
  SELECT code, bedrooms_count, rooms_count, is_duplex, label
  FROM wanted
  ON CONFLICT (code, bedrooms_count, is_duplex)
  DO UPDATE SET
    rooms_count = EXCLUDED.rooms_count,
    label = EXCLUDED.label,
    updated_at = now()
  RETURNING id, code, bedrooms_count, rooms_count, is_duplex, label
)
SELECT 1;

-- Helper CTE tpl : ids des templates ciblés
WITH tpl AS (
  SELECT id, code, bedrooms_count
  FROM unit_templates
  WHERE (code, bedrooms_count, is_duplex) IN (
    ('studio',0,false),('t1',1,false),('t2',1,false),('t3',2,false),('t4',3,false)
  )
)

-- ============================================================
-- 3) Seed EDL (base) : commun + chambres selon bedrooms_count
-- ============================================================
, base_common_edl AS (
  SELECT * FROM (VALUES
    ('Entrée','Porte d’entrée',10),
    ('Entrée','Serrure / poignée',20),
    ('Entrée','Sol',30),
    ('Entrée','Murs / plafond',40),

    ('Séjour','Sol',110),
    ('Séjour','Murs / plafond',120),
    ('Séjour','Fenêtres / volets',130),
    ('Séjour','Prises / interrupteurs',140),
    ('Séjour','Radiateur / chauffage',150),

    ('Cuisine','Évier / robinet',210),
    ('Cuisine','Plan de travail',220),
    ('Cuisine','Meubles / rangements',230),
    ('Cuisine','Plaques / cuisson',240),
    ('Cuisine','Hotte / ventilation',250),

    ('Salle de bain','Lavabo / meuble vasque',310),
    ('Salle de bain','Douche / baignoire',320),
    ('Salle de bain','WC',330),
    ('Salle de bain','Miroir / accessoires',340),
    ('Salle de bain','Ventilation (VMC)',350),

    ('Divers','Compteurs (eau/élec/gaz) - relevés',410),
    ('Divers','Clés remises (rappel)',420)
  ) v(section, label, sort_order)
),
base_bedroom_edl AS (
  -- Génère Chambre 1..N avec items
  SELECT
    CASE WHEN gs.n = 1 AND t.code IN ('studio','t1','t2') THEN 'Chambre 1' ELSE 'Chambre '||gs.n END AS section,
    it.label,
    (500 + (gs.n * 100) + it.sort_inc) AS sort_order,
    t.id AS template_id
  FROM tpl t
  JOIN LATERAL generate_series(1, GREATEST(t.bedrooms_count, 1)) AS gs(n) ON true
  JOIN LATERAL (
    VALUES
      ('Sol',10),
      ('Murs / plafond',20),
      ('Fenêtre / volets',30),
      ('Porte / poignée',40),
      ('Prises / interrupteurs',50),
      ('Placard / rangements',60)
  ) AS it(label, sort_inc) ON true
  -- studio : on ne veut pas de "Chambre", donc on filtre
  WHERE t.code <> 'studio'
),
ins_common_edl AS (
  INSERT INTO unit_template_edl_items(template_id, section, label, sort_order)
  SELECT t.id, c.section, c.label, c.sort_order
  FROM tpl t
  CROSS JOIN base_common_edl c
  ON CONFLICT (template_id, section, label)
  DO UPDATE SET sort_order = EXCLUDED.sort_order
  RETURNING 1
),
ins_bed_edl AS (
  INSERT INTO unit_template_edl_items(template_id, section, label, sort_order)
  SELECT template_id, section, label, sort_order
  FROM base_bedroom_edl
  ON CONFLICT (template_id, section, label)
  DO UPDATE SET sort_order = EXCLUDED.sort_order
  RETURNING 1
)
SELECT 1;

-- ============================================================
-- 4) Seed Inventaire (base) : commun + chambres selon bedrooms_count
-- ============================================================
WITH tpl AS (
  SELECT id, code, bedrooms_count
  FROM unit_templates
  WHERE (code, bedrooms_count, is_duplex) IN (
    ('studio',0,false),('t1',1,false),('t2',1,false),('t3',2,false),('t4',3,false)
  )
),
base_common_inv AS (
  SELECT * FROM (VALUES
    -- Cuisine (minimum)
    ('Cuisine','Assiette plate','piece',6,10),
    ('Cuisine','Verre','piece',6,20),
    ('Cuisine','Couverts (set)','piece',6,30),
    ('Cuisine','Poêle','piece',1,40),
    ('Cuisine','Casserole','piece',1,50),
    ('Cuisine','Bols','piece',4,60),

    -- Salle de bain
    ('Salle de bain','Miroir','piece',1,310),
    ('Salle de bain','Poubelle','piece',1,320),
    ('Salle de bain','Rideau douche','piece',1,330),

    -- Séjour
    ('Séjour','Table','piece',1,110),
    ('Séjour','Chaises','piece',2,120),
    ('Séjour','Canapé','piece',1,130),
    ('Séjour','Meuble TV','piece',1,140),

    -- Divers
    ('Divers','Détecteur fumée','piece',1,410),
    ('Divers','Trousseau de clés','piece',1,420)
  ) v(category, name, unit, default_qty, sort_order)
),
base_bed_inv AS (
  SELECT
    t.id AS template_id,
    ('Chambre '||gs.n) AS category,
    it.name,
    'piece'::text AS unit,
    it.qty AS default_qty,
    (200 + (gs.n * 100) + it.sort_inc) AS sort_order
  FROM tpl t
  JOIN LATERAL generate_series(1, GREATEST(t.bedrooms_count, 1)) AS gs(n) ON true
  JOIN LATERAL (
    VALUES
      ('Lit',1,10),
      ('Matelas',1,20),
      ('Armoire',1,30)
  ) AS it(name, qty, sort_inc) ON true
  WHERE t.code <> 'studio'
),
ins_common_inv AS (
  INSERT INTO unit_template_inventory_items(template_id, category, name, unit, default_qty, sort_order)
  SELECT t.id, c.category, c.name, c.unit, c.default_qty, c.sort_order
  FROM tpl t
  CROSS JOIN base_common_inv c
  ON CONFLICT (template_id, category, name, unit)
  DO UPDATE SET default_qty = EXCLUDED.default_qty, sort_order = EXCLUDED.sort_order
  RETURNING 1
),
ins_bed_inv AS (
  INSERT INTO unit_template_inventory_items(template_id, category, name, unit, default_qty, sort_order)
  SELECT template_id, category, name, unit, default_qty, sort_order
  FROM base_bed_inv
  ON CONFLICT (template_id, category, name, unit)
  DO UPDATE SET default_qty = EXCLUDED.default_qty, sort_order = EXCLUDED.sort_order
  RETURNING 1
)
SELECT 1;

-- ============================================================
-- 5) Seed VARIANTES (pour TOUS les templates)
-- ============================================================
WITH tpl AS (
  SELECT id
  FROM unit_templates
  WHERE (code, bedrooms_count, is_duplex) IN (
    ('studio',0,false),('t1',1,false),('t2',1,false),('t3',2,false),('t4',3,false)
  )
),
variants AS (
  SELECT * FROM (VALUES
    ('BALCON'),
    ('TERRASSE'),
    ('JARDIN'),
    ('PARKING'),
    ('GARAGE'),
    ('CAVE'),
    ('BUANDERIE'),
    ('CUISINE_EQUIPEE')
  ) v(variant_code)
),

-- --- EDL variant items
edl_variant_def AS (
  SELECT * FROM (VALUES
    ('BALCON','Extérieur','Garde-corps / sécurité',910),
    ('BALCON','Extérieur','Sol / étanchéité',920),

    ('TERRASSE','Extérieur','Étanchéité / évacuations',930),
    ('TERRASSE','Extérieur','Dalles / revêtement',940),

    ('JARDIN','Extérieur','Clôture / portail',950),
    ('JARDIN','Extérieur','Arrosage / point d’eau',960),

    ('PARKING','Stationnement','Emplacement / marquage',970),
    ('GARAGE','Stationnement','Porte / mécanisme',980),

    ('CAVE','Annexes','Porte / serrure',990),
    ('CAVE','Annexes','État général / humidité',1000),

    ('BUANDERIE','Buanderie','Arrivées / évacuations',1010),
    ('BUANDERIE','Buanderie','Emplacement LL',1020),

    ('CUISINE_EQUIPEE','Cuisine','Four',260),
    ('CUISINE_EQUIPEE','Cuisine','Réfrigérateur',270),
    ('CUISINE_EQUIPEE','Cuisine','Lave-vaisselle',280),
    ('CUISINE_EQUIPEE','Cuisine','Micro-ondes',290)
  ) v(variant_code, section, label, sort_order)
),
ins_edl_variants AS (
  INSERT INTO unit_template_edl_variant_items(template_id, variant_code, section, label, sort_order)
  SELECT t.id, d.variant_code, d.section, d.label, d.sort_order
  FROM tpl t
  JOIN edl_variant_def d ON true
  ON CONFLICT (template_id, variant_code, section, label)
  DO UPDATE SET sort_order = EXCLUDED.sort_order
  RETURNING 1
),

-- --- Inventory variant items
inv_variant_def AS (
  SELECT * FROM (VALUES
    ('BALCON','Extérieur','Table extérieure','piece',1,910),
    ('BALCON','Extérieur','Chaises extérieures','piece',2,920),

    ('TERRASSE','Extérieur','Salon de jardin','piece',1,930),

    ('JARDIN','Extérieur','Tondeuse','piece',1,950),
    ('JARDIN','Extérieur','Tuyau d’arrosage','piece',1,960),

    ('PARKING','Stationnement','Télécommande portail','piece',1,970),

    ('GARAGE','Stationnement','Télécommande garage','piece',1,980),

    ('CAVE','Annexes','Étagères','piece',1,990),

    ('BUANDERIE','Buanderie','Sèche-linge','piece',1,1010),

    ('CUISINE_EQUIPEE','Cuisine','Four','piece',1,260),
    ('CUISINE_EQUIPEE','Cuisine','Réfrigérateur','piece',1,270),
    ('CUISINE_EQUIPEE','Cuisine','Lave-vaisselle','piece',1,280),
    ('CUISINE_EQUIPEE','Cuisine','Micro-ondes','piece',1,290)
  ) v(variant_code, category, name, unit, default_qty, sort_order)
),
ins_inv_variants AS (
  INSERT INTO unit_template_inventory_variant_items(template_id, variant_code, category, name, unit, default_qty, sort_order)
  SELECT t.id, d.variant_code, d.category, d.name, d.unit, d.default_qty, d.sort_order
  FROM tpl t
  JOIN inv_variant_def d ON true
  ON CONFLICT (template_id, variant_code, category, name, unit)
  DO UPDATE SET default_qty=EXCLUDED.default_qty, sort_order=EXCLUDED.sort_order
  RETURNING 1
)
SELECT 1;

COMMIT;
