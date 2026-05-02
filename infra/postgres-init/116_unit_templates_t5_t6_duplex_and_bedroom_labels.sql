-- 116_unit_templates_t5_t6_duplex_and_bedroom_labels.sql
-- Ajoute T5/T6 + duplex et homogénéise Chambre -> Chambre 1.
-- Idempotent.

-- 1. Homogénéisation des libellés existants, sans créer de doublons

DELETE FROM unit_template_edl_items e
WHERE e.section = 'Chambre'
  AND EXISTS (
    SELECT 1
    FROM unit_template_edl_items existing
    WHERE existing.template_id = e.template_id
      AND existing.section = 'Chambre 1'
      AND existing.label = e.label
  );

UPDATE unit_template_edl_items
SET section = 'Chambre 1'
WHERE section = 'Chambre';

DELETE FROM unit_template_inventory_items i
WHERE i.category = 'Chambre'
  AND EXISTS (
    SELECT 1
    FROM unit_template_inventory_items existing
    WHERE existing.template_id = i.template_id
      AND existing.category = 'Chambre 1'
      AND existing.name = i.name
  );

UPDATE unit_template_inventory_items
SET category = 'Chambre 1'
WHERE category = 'Chambre';

-- 2. Templates T5/T6

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't5', 'T5', 5, 4, false
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't5' AND is_duplex = false
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't6', 'T6', 6, 5, false
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't6' AND is_duplex = false
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't5', 'T5 duplex', 5, 4, true
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't5' AND is_duplex = true
);

INSERT INTO unit_templates (code, label, rooms_count, bedrooms_count, is_duplex)
SELECT 't6', 'T6 duplex', 6, 5, true
WHERE NOT EXISTS (
  SELECT 1 FROM unit_templates WHERE code = 't6' AND is_duplex = true
);

-- 3. Copie EDL depuis T4 correspondant

WITH source_templates AS (
  SELECT id, is_duplex
  FROM unit_templates
  WHERE code = 't4'
),
target_templates AS (
  SELECT id, is_duplex
  FROM unit_templates
  WHERE code IN ('t5', 't6')
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT
  tt.id,
  CASE WHEN src.section = 'Chambre' THEN 'Chambre 1' ELSE src.section END,
  src.label,
  src.sort_order
FROM target_templates tt
JOIN source_templates st ON st.is_duplex = tt.is_duplex
JOIN unit_template_edl_items src ON src.template_id = st.id
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items existing
  WHERE existing.template_id = tt.id
    AND existing.section = CASE WHEN src.section = 'Chambre' THEN 'Chambre 1' ELSE src.section END
    AND existing.label = src.label
);

-- 4. Copie inventaire depuis T4 correspondant

WITH source_templates AS (
  SELECT id, is_duplex
  FROM unit_templates
  WHERE code = 't4'
),
target_templates AS (
  SELECT id, is_duplex
  FROM unit_templates
  WHERE code IN ('t5', 't6')
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
  CASE WHEN src.category = 'Chambre' THEN 'Chambre 1' ELSE src.category END,
  src.name,
  src.unit,
  src.default_qty,
  src.sort_order
FROM target_templates tt
JOIN source_templates st ON st.is_duplex = tt.is_duplex
JOIN unit_template_inventory_items src ON src.template_id = st.id
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items existing
  WHERE existing.template_id = tt.id
    AND existing.category = CASE WHEN src.category = 'Chambre' THEN 'Chambre 1' ELSE src.category END
    AND existing.name = src.name
);

-- 5. Ajout Chambre 4 pour T5/T6

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE code IN ('t5', 't6')
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT t.id, section_label, item_label, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Chambre 4', 'Sol', 430),
    ('Chambre 4', 'Murs', 431),
    ('Chambre 4', 'Plafond', 432),
    ('Chambre 4', 'Fenêtres / ouvrants', 433),
    ('Chambre 4', 'Électricité / prises / interrupteurs', 434)
) AS x(section_label, item_label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items e
  WHERE e.template_id = t.id
    AND e.section = x.section_label
    AND e.label = x.item_label
);

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE code IN ('t5', 't6')
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
    ('Chambre 4', 'Lit', 1, 430),
    ('Chambre 4', 'Matelas', 1, 431),
    ('Chambre 4', 'Armoire / rangement', 1, 432),
    ('Chambre 4', 'Luminaire', 1, 433)
) AS x(category_label, item_name, qty, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items i
  WHERE i.template_id = t.id
    AND i.category = x.category_label
    AND i.name = x.item_name
);

-- 6. Ajout Chambre 5 pour T6 uniquement

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE code = 't6'
)
INSERT INTO unit_template_edl_items (template_id, section, label, sort_order)
SELECT t.id, section_label, item_label, sort_order
FROM targets t
CROSS JOIN (
  VALUES
    ('Chambre 5', 'Sol', 530),
    ('Chambre 5', 'Murs', 531),
    ('Chambre 5', 'Plafond', 532),
    ('Chambre 5', 'Fenêtres / ouvrants', 533),
    ('Chambre 5', 'Électricité / prises / interrupteurs', 534)
) AS x(section_label, item_label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_edl_items e
  WHERE e.template_id = t.id
    AND e.section = x.section_label
    AND e.label = x.item_label
);

WITH targets AS (
  SELECT id
  FROM unit_templates
  WHERE code = 't6'
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
    ('Chambre 5', 'Lit', 1, 530),
    ('Chambre 5', 'Matelas', 1, 531),
    ('Chambre 5', 'Armoire / rangement', 1, 532),
    ('Chambre 5', 'Luminaire', 1, 533)
) AS x(category_label, item_name, qty, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM unit_template_inventory_items i
  WHERE i.template_id = t.id
    AND i.category = x.category_label
    AND i.name = x.item_name
);