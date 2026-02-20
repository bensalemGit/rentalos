# Cloudflare Access — Setup (résumé)

Objectif :
- protéger `app.rentalos.fr` (web + api)
- permettre :
  - humains via allowlist email
  - CI/Postman/Newman via Service Token

Policies recommandées :
- SERVICE AUTH -> Service Token
- ALLOW -> Emails

Résultat attendu :
- l’API renvoie du JSON (pas de HTML Cloudflare)
- newman passe 0 failed avec headers service token

Checklist :
- service token actif (id/secret)
- policy appliquée sur hostname
- allowlist emails OK
- pas de bypass involontaire