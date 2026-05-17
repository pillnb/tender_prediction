<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This project uses Next.js 16 with the App Router and Turbopack-aware configuration. Before changing framework-level behavior, read the relevant guide in `node_modules/next/dist/docs/` and prefer current local docs over memory.

<!-- END:nextjs-agent-rules -->

# Project Overview

This repository contains a web-based tender pricing calculator for Indonesian project bidding workflows.
The application helps users estimate direct cost, indirect cost, profit, CGL/insurance, and final rounded tender value from a structured set of operational inputs.

The current UI is a dashboard-style estimator with these major sections:

- `Deskripsi Proyek`: metadata for the bid and project context.
- `Biaya Tenaga Kerja`: crew composition, manpower count, duration, and all-in wages.
- `Mob & Demob`: personnel mobilization and equipment handling.
- `Biaya Peralatan`: equipment name, quantity, frequency, and unit cost.
- `Biaya Material / Operational & Site Costs`: supporting items such as meal, lodging, reporting, permit, and MCU.
- `Tax & Margin`: overhead, profit target, CGL/insurance, and rounding control.
- `Overview`: summary of the calculated tender value.

# Business Goal

The calculator should mirror real tender calculation logic used in operational bidding documents.
Accuracy of cost flow matters more than visual polish.
When tradeoffs appear, preserve calculation clarity, traceability, and maintainability.

# Calculation Flow

Implement and maintain the calculator according to this order:

1. Capture direct cost inputs:
   - Project description
   - Labor cost
   - Mob & demob
   - Equipment cost
   - Supporting material / accommodation cost
2. Capture indirect cost / overhead:
   - Percentage
   - Optional fixed-value interpretation if needed by product requirements
   - Default formula: `overhead = overheadPercentage x subtotal biaya langsung`
3. Calculate total cost before profit:
   - `totalSebelumProfit = totalBiayaLangsung + overhead + biayaTambahanLainYangDianggapPraProfit`
4. Calculate profit:
   - `profit = profitPercentage x totalSebelumProfit`
5. Add CGL / insurance:
   - CGL must be treated as a real monetary input
   - It must appear in the UI and in the summary
   - It must be included before final price output is produced
6. Calculate final tender price:
   - `totalHargaAkhir = totalSebelumProfit + profit`
   - Apply configured rounding rule last

# Required Input Semantics

Match the business meaning of each field:

## A. Deskripsi Proyek

- Nama pekerjaan
- Kategori proyek
- Lokasi proyek
- Nama perusahaan
- Kategori perusahaan
- Durasi pekerjaan
- Tanggal pekerjaan

## B. Biaya Tenaga Kerja

- Komposisi crew
- Jumlah tenaga kerja
- Durasi per crew
- Upah all in

## C. Mob & Demob

- Mob demob personil: `qty`, `freq`, `harga`
- Equipment handling: `qty`, `freq`, `harga`

## D. Biaya Peralatan

- Nama alat
- Banyak alat
- Frekuensi
- Harga satuan

## E. Biaya Material / Supporting / Akomodasi

- Meal
- Penginapan
- Reporting
- Permit
- MCU

Special rule:

- `Meal Allowance` and `Penginapan` are not valid as unit-price-only fields.
- They must always be backed by quantity and frequency drivers, even if the UI hides or auto-fills those values.
- If the UI chooses to simplify the display, the code must still preserve `qty` and `freq` in the data model.

# Architecture Rules

Keep the codebase simple, explicit, and easy for the next agent to extend.

## Preferred Structure

- `src/app`: route entrypoints and page composition only.
- `src/components/layout`: navigation and layout scaffolding.
- `src/components/features/tender`: feature-level UI grouped by tender domain.
- `src/components/ui`: generic shared primitives only.
- `src/lib`: pure helpers, formatters, calculation utilities, and stateless domain helpers.

## Separation of Concerns

- UI components should focus on rendering and user interaction.
- Calculation logic should move toward `src/lib` or dedicated tender-domain helpers when it grows.
- Avoid burying business formulas inside deeply nested JSX.
- Repeated numeric parsing and currency formatting should be centralized.
- If a component starts carrying too much state, extract a smaller subcomponent or a domain helper.

## State Management

- Keep state as close as possible to the feature that owns it.
- Lift shared calculator state only when multiple sections depend on the same values.
- Prefer deterministic derived values with plain calculations over duplicated state.
- Never store a value in state if it can be derived safely from existing state.

## Data Modeling

- Use explicit TypeScript types for tender inputs and calculation outputs.
- Name fields by business meaning, not only by UI label.
- Prefer `rate`, `qty`, `freq`, `subtotal`, `overheadRate`, `profitMargin`, `insuranceCost`, and similarly precise names.

# Clean Code Expectations

- Use small, composable components.
- Prefer pure helper functions for formulas.
- Avoid magic numbers without naming or explanation.
- Remove dead code, unused imports, unreachable branches, and placeholder scaffolding once real logic exists.
- Keep JSX readable; extract repeated patterns rather than copy-pasting large blocks.
- Avoid mixing display formatting with arithmetic values in the same variable.
- Use comments sparingly and only when explaining business reasoning or non-obvious constraints.

# Clean Architecture Expectations

- Business rules must be independent from visual layout as much as practical.
- Feature components should not become dumping grounds for formatting, parsing, validation, and formulas all at once.
- When adding new tender sections, model the domain first, then bind it to UI.
- Favor stable interfaces between page composition, feature components, and calculation helpers.

# Repository Hygiene

- Keep the repo free from generated clutter unless intentionally committed.
- Preserve a clean import structure.
- Reuse shared utilities before introducing new one-off helpers.
- Do not introduce parallel patterns for the same concern.
- Prefer one canonical currency parser/formatter path.

# Linting And Formatting

The repository uses ESLint and Prettier. Keep them passing at all times.

Before finishing meaningful changes, run:

```bash
npm run lint
npm run format:check
```

Use these conventions:

- ESLint guards correctness, unused code, and risky patterns.
- Prettier guards formatting consistency.
- Do not bypass lint errors with disable comments unless there is a documented and justified reason.

# Change Policy For Agents

When changing the calculator:

- Preserve the tender calculation flow above.
- Make sure UI labels, field semantics, and formulas stay aligned.
- If you change a formula, update both the code and the summary presentation.
- If you add a new cost driver, make the unit semantics explicit.
- If you simplify the UI, do not drop required business inputs from the underlying model.

# Current Priorities

- Keep CGL / insurance visible and included in the calculation flow.
- Preserve `qty` and `freq` semantics for meal allowance and lodging.
- Continue moving the dashboard from static mockup behavior toward a reliable calculation engine.
- Reduce code smell by extracting reusable formatting and domain logic.
- Keep the repo easy for future agentic workflows to understand and extend.
