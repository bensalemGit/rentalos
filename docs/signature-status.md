# Signature Status API

## Endpoint
GET /api/signature-status?leaseId=<uuid>

Auth: JWT required.

## Purpose
Expose a unified view of signature progress for:
- Contract (tenants + landlord)
- Selected CAUTION guarantees (multi)

## Response (high level)
- contract:
  - documentId / signedFinalDocumentId
  - status: NOT_GENERATED | DRAFT | IN_PROGRESS | SIGNED
  - landlord: NOT_SENT | SENT | SIGNED
  - tenants[]: NOT_SENT | SENT | SIGNED
- guarantees[]:
  - actDocumentId / signedFinalDocumentId
  - signatureStatus: NOT_SENT | SENT | IN_PROGRESS | SIGNED