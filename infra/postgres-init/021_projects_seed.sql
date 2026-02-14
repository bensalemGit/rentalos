INSERT INTO projects (name, kind, notes)
VALUES
 ('INDIVISION DES POINTES','indivision','4 indivisaires'),
 ('PUECH-BAUDOIN','couple','Couple propriétaire'),
 ('DIOURI-DU RIEU','couple','Couple propriétaire')
ON CONFLICT DO NOTHING;

-- Exemples membres (uniquement pour l'indivision)
DO $$
DECLARE pid uuid;
BEGIN
  SELECT id INTO pid FROM projects WHERE name='INDIVISION DES POINTES' LIMIT 1;
  IF pid IS NOT NULL THEN
    INSERT INTO project_members (project_id, full_name, role, share_pct)
    VALUES
      (pid,'Indivisaire 1','indivisaire',25),
      (pid,'Indivisaire 2','indivisaire',25),
      (pid,'Indivisaire 3','indivisaire',25),
      (pid,'Indivisaire 4','indivisaire',25)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
