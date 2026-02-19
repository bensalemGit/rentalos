\# Templates Contrats — RentalOS



RentalOS génère les documents PDF (contrats, notices…) à partir de templates HTML stockés directement dans PostgreSQL.



Ce fichier explique :



\- où sont stockés les templates

\- comment faire un backup avant modification

\- comment mettre à jour un contrat proprement (UTF-8 safe)

\- quelles vérifications exécuter



---



\## 1. Table SQL utilisée



Tous les templates sont stockés dans :



```sql

document\_templates



Chaque template est identifié par :



kind (ex: CONTRACT, NOTICE…)



lease\_kind (MEUBLE\_RP, NU\_RP…)



version (ex: 2026-02)



2\. Template principal (Contrat Meublé RP)



Contrat utilisé actuellement :



kind = CONTRACT



lease\_kind = MEUBLE\_RP



version = 2026-02



Vérification :



SELECT id, title, version, length(html\_template) AS len

FROM document\_templates

WHERE kind='CONTRACT'

&nbsp; AND lease\_kind='MEUBLE\_RP'

&nbsp; AND version='2026-02';







3\. Règle d’or : Toujours faire un backup avant modification



Avant toute mise à jour du contrat :



Backup automatique horodaté



BEGIN;



WITH src AS (

&nbsp; SELECT \*

&nbsp; FROM document\_templates

&nbsp; WHERE kind='CONTRACT'

&nbsp;   AND lease\_kind='MEUBLE\_RP'

&nbsp;   AND version='2026-02'

&nbsp; LIMIT 1

)

INSERT INTO document\_templates (

&nbsp; id,

&nbsp; kind,

&nbsp; lease\_kind,

&nbsp; version,

&nbsp; title,

&nbsp; html\_template

)

SELECT

&nbsp; gen\_random\_uuid(),

&nbsp; kind,

&nbsp; lease\_kind,

&nbsp; '2026-02-backup-' || to\_char(now(),'YYYYMMDD-HH24MISS'),

&nbsp; title || ' (backup)',

&nbsp; html\_template

FROM src;



COMMIT;



👉 Résultat : une copie du template est créée, par exemple :



2026-02-backup-20260217-213500





4\. Mise à jour du contrat (UTF-8 Safe)



⚠️ Important : le HTML doit toujours être injecté avec du dollar quoting.



Exemple complet :



BEGIN;



UPDATE document\_templates

SET

&nbsp; title = 'Contrat de location meublée (Résidence principale) — 2026-02',

&nbsp; html\_template = $HTML$

<!doctype html>

<html lang="fr">

<head>

&nbsp; <meta charset="utf-8"/>

&nbsp; <title>Contrat location meublée — {{unit\_code}}</title>

</head>

<body>



<h1>Contrat de location meublée</h1>



<h2>Locataires</h2>

{{tenants\_block}}



<h2>Clause colocation</h2>

{{colocation\_clause}}



<h2>Garants</h2>

{{guarantor\_block}}



<h2>Visale</h2>

{{visale\_block}}



<h2>Charges</h2>

{{charges\_clause\_html}}



<h2>Révision IRL</h2>

{{irl\_clause\_html}}



</body>

</html>

$HTML$

WHERE kind='CONTRACT'

&nbsp; AND lease\_kind='MEUBLE\_RP'

&nbsp; AND version='2026-02';



COMMIT;



5\. Placeholders critiques (obligatoires)



Le contrat doit contenir ces variables :



{{tenants\_block}}



{{colocation\_clause}}



{{guarantor\_block}}



{{visale\_block}}



{{charges\_clause\_html}}



{{irl\_clause\_html}}



Test SQL :





SELECT

&nbsp; (html\_template LIKE '%{{tenants\_block}}%') as tenants,

&nbsp; (html\_template LIKE '%{{colocation\_clause}}%') as colocation,

&nbsp; (html\_template LIKE '%{{guarantor\_block}}%') as guarantor,

&nbsp; (html\_template LIKE '%{{visale\_block}}%') as visale,

&nbsp; (html\_template LIKE '%{{charges\_clause\_html}}%') as charges,

&nbsp; (html\_template LIKE '%{{irl\_clause\_html}}%') as irl

FROM document\_templates

WHERE kind='CONTRACT'

&nbsp; AND lease\_kind='MEUBLE\_RP'

&nbsp; AND version='2026-02';







Tout doit être à true.



6\. Vérification sécurité : Aucun SQL parasite dans le HTML



On doit s’assurer que le HTML ne contient jamais :



BEGIN



COMMIT



UPDATE



Test :



SELECT

&nbsp; position('COMMIT;' in html\_template) as has\_commit,

&nbsp; position('BEGIN' in html\_template) as has\_begin,

&nbsp; position('UPDATE' in html\_template) as has\_update,

&nbsp; position('<!doctype html' in lower(html\_template)) as has\_doctype

FROM document\_templates

WHERE kind='CONTRACT'

&nbsp; AND lease\_kind='MEUBLE\_RP'

&nbsp; AND version='2026-02';







Résultat attendu :



has\_commit = 0



has\_begin = 0



has\_update = 0



has\_doctype > 0



7\. Next Steps



À venir :



ajout template NU\_RP



ajout template SAISONNIER



versioning officiel (2026-03)



UI Visale complète



génération automatique du pack contract + annexes





---



\# ✅ Ensuite commit/push (clé en main)



```powershell

cd C:\\rentalos



git add docs/TEMPLATES.md

git commit -m "docs: add official templates guide (backup + update UTF-8)"

git push origin main

---

# ♻️ Rollback (restaurer un backup)

Lister les backups :

```sql
SELECT version, title
FROM document_templates
WHERE kind='CONTRACT'
AND lease_kind='MEUBLE_RP'
AND version LIKE '2026-02-backup-%'
ORDER BY version DESC;

Restaurer un backup :
UPDATE document_templates
SET html_template = b.html_template
FROM document_templates b
WHERE b.version='2026-02-backup-YYYYMMDD-HHMMSS'
AND document_templates.kind='CONTRACT'
AND document_templates.lease_kind='MEUBLE_RP'
AND document_templates.version='2026-02';

✅ Retour immédiat à la version précédente.

---

# ✅ Conclusion

Tu es **à 95% prêt passation “nouveau chat/dev”**.

Avec ces 3 micro-ajouts, ton pack docs devient :

- zéro ambiguïté
- rollback instantané
- signature multi-locataire béton côté UI

---

# 🚀 Next Step logique (GO 2)

Maintenant qu’on a la doc clean :

## Prochaine étape : Test automatique du workflow signature

Je te prépare un script E2E :

- bail avec 2 locataires
- signature locataire 1
- signature locataire 2
- signature bailleur
- vérif PDF final généré

👉 Dis juste :

**GO TEST AUTO SIGN FLOW**

et on enchaîne direct.










