# Exit Flow (Sortie locataire)

## Objectif
Formaliser la clôture d’un bail avec :
- EDL de sortie signé
- Inventaire de sortie signé
- Attestation de sortie
- Pack sortie

## Étapes

### 1. Préparation
- Copie entrée → sortie (EDL + inventaire)
- Remplissage sortie

### 2. Signature sortie
- Signature locataire + bailleur
- Génération des signed_final :
  - EDL_SORTIE
  - INVENTAIRE_SORTIE

### 3. Attestation de sortie
- Générée uniquement si :
  - EDL_SORTIE signed_final existe
  - INVENTAIRE_SORTIE signed_final existe

### 4. Pack sortie
Contient :
- EDL sortie signed final
- Inventaire sortie signed final
- Attestation sortie

## Types documentaires

- EDL_SORTIE
- INVENTAIRE_SORTIE
- ATTESTATION_SORTIE
- PACK_EDL_INV_SORTIE

## Règles

- Aucun document sortie n’est généré automatiquement
- Tout est déclenché explicitement (UI)
- Les documents sortie sont indépendants du pack final