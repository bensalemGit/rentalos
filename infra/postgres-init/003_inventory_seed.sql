INSERT INTO inventory_catalog_items (category, name, unit, default_qty) VALUES
('Cuisine','Assiette plate','piece',6),
('Cuisine','Verre eau','piece',6),
('Cuisine','Couverts (fourchettes)','piece',6),
('Cuisine','Poêle','piece',1),
('Cuisine','Casserole','piece',2),
('Cuisine','Réfrigérateur','piece',1),
('Cuisine','Micro-ondes','piece',1),
('Séjour','Canapé','piece',1),
('Chambre','Lit','piece',1),
('Divers','Aspirateur','piece',1)
ON CONFLICT DO NOTHING;
