# Stock Summary Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the stock summary tab as a dense, sortable market table matching the supplied reference.

**Architecture:** Keep the backend contract unchanged and derive presentation metrics from existing `Signal` fields in a focused frontend utility. Deduplicate summary rows by stock code, retain the strongest signal, and render sortable columns with existing `DataTable`.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, existing virtualized `DataTable`.

---

### Task 1: Lock the Summary Contract

**Files:**
- Create: `scripts/qa/stock-summary-contract-check.cjs`

- [ ] Write a static contract that requires the target columns, stock-code deduplication, and descending daily-change ordering.
- [ ] Run `node scripts/qa/stock-summary-contract-check.cjs`.
- [ ] Confirm it fails before implementation.

### Task 2: Implement Summary Metrics and Table

**Files:**
- Create: `src/utils/summarySignal.ts`
- Modify: `src/pages/timing/SummaryTab.tsx`

- [ ] Add helpers for daily change, selection return, signed percentage formatting, and strongest-signal deduplication.
- [ ] Replace the old confidence/alert table with the confirmed column order.
- [ ] Add sorters for code, mode, sector, daily change, entry price, entry return, and today's P&L.
- [ ] Apply yellow stock identity, blue sector, orange strategy, and red-rise/green-fall styling.
- [ ] Run the contract check and confirm it passes.

### Task 3: Verify Production UI

**Files:**
- Verify: `src/pages/timing/SummaryTab.tsx`
- Verify: `dist/`

- [ ] Run `npm run build`.
- [ ] Open the timing page in the local browser.
- [ ] Check that columns fit, rows remain dense, sorting works, and no stock is duplicated.
