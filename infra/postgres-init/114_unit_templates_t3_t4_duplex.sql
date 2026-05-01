-- 114_unit_templates_t3_t4_duplex.sql
-- Ajoute les templates T3/T4 et versions duplex à partir du template T2 existant.
-- Idempotent : peut être rejoué sans dupliquer les templates.

-- =========================
-- 1. Templates de base
-- =========================

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't3', 'T3', 3, 2, false
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't3' AND is_duplex = false
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't4', 'T4', 4, 3, false
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't4' AND is_duplex = false
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't2', 'T2 duplex', 2, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't2' AND is_duplex = true
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't3', 'T3 duplex', 3, 2, true
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't3' AND is_duplex = true
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't4', 'T4 duplex', 4, 3, true
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't4' AND is_duplex = true
);

-- =========================
-- 2. Copie items EDL depuis T2 non duplex
-- =========================

WITH source_template AS (
  SELECT id
  FROM unit_templates
  WHERE code = 't2' AND is_duplex = false
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
),
target_templates AS (
  SELECT id
  FROM unit_templates
  WHERE (code = 't3' AND is_duplex = false)
     OR (code = 't4' AND is_duplex = false)
     OR (code = 't2' AND is_duplex = true)
     OR (code = 't3' AND is_duplex = true)
     OR (code = 't4' AND is_duplex = true)
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT
  tt.id,
  src.section,
  src.label,
  src.sort_order
FROM target_templates tt
CROSS JOIN source_template st
JOIN unit_template_edl_items src ON src.template_id = st.id
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items existing
  WHERE existing.template_id = tt.id
    AND existing.section = src.section
    AND existing.label = src.label
);

-- =========================
-- 3. Copie inventaire depuis T2 non duplex
-- =========================

WITH source_template AS (
  SELECT id
  FROM unit_templates
  WHERE code = 't2' AND is_duplex = false
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1
),
target_templates AS (
  SELECT id
  FROM unit_templates
  WHERE (code = 't3' AND is_duplex = false)
     OR (code = 't4' AND is_duplex = false)
     OR (code = 't2' AND is_duplex = true)
     OR (code = 't3' AND is_duplex = true)
     OR (code = 't4' AND is_duplex = true)
)
INSERT INTO unit_template_inventory_items (
  template_id,
  category,
  name,
  unit,
  default_qty,
  sort_order
)
SELECT
  tt.id,
  src.category,
  src.name,
  src.unit,
  src.default_qty,
  src.sort_order
FROM target_templates tt
CROSS JOIN source_template st
JOIN unit_template_inventory_items src ON src.template_id = st.id
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items existing
  WHERE existing.template_id = tt.id
    AND existing.category = src.category
    AND existing.name = src.name
);

-- =========================
-- 4. Ajout pièces spécifiques T3/T4 EDL
-- =========================

WITH targets AS (
  SELECT id, code, is_duplex
  FROM unit_templates
  WHERE code IN ('t3', 't4')
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT t.id, section_label, item_label, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Chambre 2', 'Sol', 310),
    ('Chambre 2', 'Murs', 311),
    ('Chambre 2', 'Plafond', 312),
    ('Chambre 2', 'Fenêtres / ouvrants', 313),
    ('Chambre 2', 'Électricité / prises / interrupteurs', 314)
) AS x(section_label, item_label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items e
  WHERE e.template_id = t.id
    AND e.section = x.section_label
    AND e.label = x.item_label
);

WITH targets AS (
  SELECT id, code, is_duplex
  FROM unit_templates
  WHERE code = 't4'
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT t.id, section_label, item_label, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Chambre 3', 'Sol', 330),
    ('Chambre 3', 'Murs', 331),
    ('Chambre 3', 'Plafond', 332),
    ('Chambre 3', 'Fenêtres / ouvrants', 333),
    ('Chambre 3', 'Électricité / prises / interrupteurs', 334)
) AS x(section_label, item_label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items e
  WHERE e.template_id = t.id
    AND e.section = x.section_label
    AND e.label = x.item_label
);

-- =========================
-- 5. Ajout éléments duplex EDL
-- =========================

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE is_duplex = true
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT t.id, section_label, item_label, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Escalier intérieur', 'Marches', 900),
    ('Escalier intérieur', 'Rampe / garde-corps', 901),
    ('Escalier intérieur', 'Murs', 902),
    ('Escalier intérieur', 'Éclairage', 903),
    ('Palier / dégagement étage', 'Sol', 910),
    ('Palier / dégagement étage', 'Murs', 911),
    ('Palier / dégagement étage', 'Plafond', 912)
) AS x(section_label, item_label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items e
  WHERE e.template_id = t.id
    AND e.section = x.section_label
    AND e.label = x.item_label
);

-- =========================
-- 6. Ajout inventaire chambres T3/T4
-- =========================

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE code IN ('t3', 't4')
)
INSERT INTO unit_template_inventory_items (
  template_id,
  category,
  name,
  unit,
  default_qty,
  sort_order
)
SELECT t.id, category_label, item_name, 'piece', qty, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Chambre 2', 'Lit', 1, 310),
    ('Chambre 2', 'Matelas', 1, 311),
    ('Chambre 2', 'Armoire / rangement', 1, 312),
    ('Chambre 2', 'Luminaire', 1, 313)
) AS x(category_label, item_name, qty, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items i
  WHERE i.template_id = t.id
    AND i.category = x.category_label
    AND i.name = x.item_name
);

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE code = 't4'
)
INSERT INTO unit_template_inventory_items (
  template_id,
  category,
  name,
  unit,
  default_qty,
  sort_order
)
SELECT t.id, category_label, item_name, 'piece', qty, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Chambre 3', 'Lit', 1, 330),
    ('Chambre 3', 'Matelas', 1, 331),
    ('Chambre 3', 'Armoire / rangement', 1, 332),
    ('Chambre 3', 'Luminaire', 1, 333)
) AS x(category_label, item_name, qty, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items i
  WHERE i.template_id = t.id
    AND i.category = x.category_label
    AND i.name = x.item_name
);

-- =========================
-- 7. Ajout inventaire duplex
-- =========================

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE is_duplex = true
)
INSERT INTO unit_template_inventory_items (
  template_id,
  category,
  name,
  unit,
  default_qty,
  sort_order
)
SELECT t.id, category_label, item_name, 'piece', qty, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Escalier intérieur', 'Rampe / garde-corps', 1, 900),
    ('Escalier intérieur', 'Luminaire escalier', 1, 901),
    ('Palier / dégagement étage', 'Luminaire palier', 1, 910)
) AS x(category_label, item_name, qty, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items i
  WHERE i.template_id = t.id
    AND i.category = x.category_label
    AND i.name = x.item_name
);