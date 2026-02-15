## [Unreleased] - 2026-02-15

### Fixed
- Inventory: fix "Add line" failing with 500 due to `inventory_lines.exit_state` NOT NULL constraint.
  - Backend insert now omits exit_state so DB default / nullability applies.
  - SQL migration added: drop NOT NULL on `inventory_lines.exit_state`.

### Notes
- Runtime E2E step 4.6 was failing; now validated after patch.
