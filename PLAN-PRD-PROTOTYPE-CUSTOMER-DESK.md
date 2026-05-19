STATUS: done

PROJECT_NAME: Customer Desk
PROJECT_SLUG: customer-desk
PLATFORM: web
TECH_STACK: vite-react
UI_LANGUAGE: English
DB_REQUIRED: postgres
DESIGN_REQUIRED: true

PRD:
# Customer Desk Product Contract

## 1. Context And Goals
- Overview: Customer Desk is a compact browser CRM for managing accounts, contacts, leads, opportunities, activities, saved filters, reporting insights, settings, empty states, and error recovery. The app must open directly into working CRM operations, not a marketing page.
- Target Audience: sales operators, account managers, operations leads, and reviewers who need fast scanning, follow-up visibility, and deterministic state changes.
- Business Goals: improve pipeline clarity, reduce missed follow-ups, expose operational bottlenecks, and keep every visible action tied to real state.
- User Goals: find accounts quickly, inspect related context, update deal/activity state, manage saved filters, review insights, adjust workflow settings, and recover from empty/error states.
- Primary Workflows: inspect current account/pipeline state; search and filter records; create or update accounts, contacts, leads, opportunities, and activities; review insights; update preferences; retry or reset recoverable errors.
- Non-Functional Targets: compact layout, keyboard-accessible controls, no text overflow, deterministic test handles, fast first interaction, and responsive desktop/tablet behavior.
- External Dependencies: none required by PLAN. MC supplies runtime paths, repo names, branch names, env values, deployment names, and persistence configuration.

## 2. Data And State Contract
### Entities
- Account: id uuid required, name string required, status enum required, owner string, priority enum, tags string[], createdAt timestamp, updatedAt timestamp.
- Contact: id uuid required, accountId uuid required, name string required, email string, role string, lastTouch timestamp.
- Lead: id uuid required, source string, score number, stage enum, nextAction string, owner string.
- Opportunity: id uuid required, accountId uuid required, value number, probability number, stage enum, closeDate date, blocker string.
- Activity: id uuid required, relatedEntityId uuid, type enum, dueAt timestamp, completed boolean, notes string.
- Preference: id string required, savedFilters json, notificationRules json, density enum.

### State Architecture
- Server State: shared CRM records and preferences live in Postgres when MC provisions persistence.
- Client/Local State: active filters, selected record, drafts, open panels, loading flags, action counters, and recoverable error state.
- URL/Router State: active surface, selected record id, saved view id, and query/filter state when appropriate.
- Persisted Preferences: saved filters, density, notification toggles, and last selected view.
- Side Effects: saves update summaries and timelines; filters update counts; retries clear scoped failures without wiping unrelated state.

### Data Flow
- Read Path: load seed or persisted records, derive summaries, then bind collections to the active surface.
- Write Path: validate input, update domain state, update dependent summaries, persist when enabled, then provide user feedback.
- Error Path: keep the user in context, show field/system feedback, preserve drafts when safe, and expose retry/reset controls.
- Seed States: include active accounts, stale leads, blocked opportunities, overdue activities, empty-filter results, and recoverable storage failure fixtures.

## 3. Behavioral And Action Contract
### ACTION: ACT_SEARCH_ACCOUNTS
- Surface Bound: SURF_ACCOUNT_AND_CONTACT_MANAGEMENT
- Trigger: user changes the persistent search input.
- Preconditions & Auth: CRM data has loaded; auth is required only when shared persistence is enabled.
- Async Behavior: immediate local filtering; no blocking spinner; idempotent.
- Expected Effect (Success): visible records, counters, empty states, and related summaries reflect the query.
- Fallback Behavior (Error): keep prior results and show a recoverable filter error.
- Navigation After Success: same surface.
- State Changes: update active query, visible collection, summary counters, and no-result flag.
- Persistence Effects: persist saved view only when the user explicitly saves it.
- User Feedback: show result count and clear-filter affordance.

### ACTION: ACT_SAVE_RECORD
- Surface Bound: SURF_ACCOUNT_AND_CONTACT_MANAGEMENT
- Trigger: user submits a create/edit form or inline edit.
- Preconditions & Auth: required fields valid; user role may create or edit the record.
- Async Behavior: disable submit, show loading state, timeout after 10000ms, idempotent when record id is stable.
- Expected Effect (Success): record is created or updated, summaries refresh, related references update, and the changed record is inspectable.
- Fallback Behavior (Error): preserve form data, show inline field/system errors, and allow retry.
- Navigation After Success: return to the previous productive context or keep the updated detail open.
- State Changes: update domain record, dirty flags, selected record, counters, and timeline.
- Persistence Effects: write to the configured persistence layer when available.
- User Feedback: success confirmation with clear changed state.

### ACTION: ACT_ADVANCE_OPPORTUNITY
- Surface Bound: SURF_LEAD_AND_OPPORTUNITY_WORKFLOW
- Trigger: user advances, wins, loses, or reopens an opportunity stage.
- Preconditions & Auth: opportunity exists; stage transition is allowed; required loss/win fields are present when needed.
- Async Behavior: show scoped loading on the changed row/card; idempotent for the same target stage.
- Expected Effect (Success): pipeline stage, probability, value totals, activity recommendations, and timeline update.
- Fallback Behavior (Error): restore prior stage and show business-rule feedback.
- Navigation After Success: same surface.
- State Changes: update opportunity stage, summaries, forecast totals, and next action.
- Persistence Effects: persist stage transition and audit/timeline event.
- User Feedback: stage change confirmation and visible forecast change.

### ACTION: ACT_RECOVER_STATE
- Surface Bound: SURF_EMPTY_LOADING_AND_ERROR_RECOVERY
- Trigger: user clicks retry, clear filters, create first record, or reset corrupted data.
- Preconditions & Auth: active state is empty, failed, filtered to zero, or corrupted.
- Async Behavior: show scoped loading for retry/reset; destructive reset requires confirmation.
- Expected Effect (Success): app returns to a usable CRM state without unrelated data loss.
- Fallback Behavior (Error): keep diagnostic context and offer another retry or safe reset.
- Navigation After Success: same surface or the most relevant productive surface.
- State Changes: clear recoverable error, reset corrupted data when confirmed, update visible records.
- Persistence Effects: remove only corrupted or explicitly reset data.
- User Feedback: explain what changed and what action is available next.

## 4. Product Surfaces
> DESIGN AUTHORITY LIES WITH STITCH MANIFEST. PLAN defines semantic surfaces only; Stitch determines physical screens, routing, drawers, tabs, modals, and component hierarchy.

### SURFACE: SURF_ACCOUNT_AND_CONTACT_MANAGEMENT
- Name: Account and contact management
- Purpose: Help users understand who each customer is, what relationship exists, and what needs attention next.
- Data Entities Bound: Account, Contact, Opportunity, Activity, Preference
- Core Content: accounts, contacts, ownership, tags, lifecycle status, recent activity, linked opportunities, and notes.
- Permitted Actions: ACT_SEARCH_ACCOUNTS search_input_persistent, ACT_SAVE_RECORD primary_button
- Entry Points: direct_url, saved_view, opportunity context
- Exit And Guard Rules: preserve active filters and return context; auth is required when shared data is enabled.
- Auth Required: true
- Design Guidance: compact, scan-friendly, relationship-first CRM interface; no decorative profile filler.

### SURFACE: SURF_LEAD_AND_OPPORTUNITY_WORKFLOW
- Name: Lead and opportunity workflow
- Purpose: Help users qualify leads, move deals through stages, and see the next action required to progress revenue work.
- Data Entities Bound: Lead, Opportunity, Account, Activity
- Core Content: stage, value, probability, expected close date, owner, blockers, next task, and recent changes.
- Permitted Actions: ACT_ADVANCE_OPPORTUNITY primary_button, ACT_SAVE_RECORD form_submit
- Entry Points: direct_url, account context, saved pipeline filter
- Exit And Guard Rules: invalid transitions show business-rule feedback and preserve the current stage.
- Auth Required: true
- Design Guidance: make stage and next action clear; avoid static charts without operational actions.

### SURFACE: SURF_ACTIVITY_AND_TASK_FOLLOW_UP
- Name: Activity and task follow-up
- Purpose: Prevent missed calls, emails, meetings, and internal tasks.
- Data Entities Bound: Activity, Account, Contact, Opportunity
- Core Content: timeline, due dates, overdue items, completed actions, reminders, assignees, and linked customer context.
- Permitted Actions: ACT_SAVE_RECORD primary_button, ACT_RECOVER_STATE secondary_button
- Entry Points: account context, opportunity context, overdue filter
- Exit And Guard Rules: completed tasks remain visible in timeline context.
- Auth Required: true
- Design Guidance: overdue and next-best-action signals must be prominent without turning the app into a calendar clone.

### SURFACE: SURF_REPORTING_AND_INSIGHTS
- Name: Reporting and insights
- Purpose: Help managers compare pipeline health, workload, overdue work, conversion movement, and team performance.
- Data Entities Bound: Account, Lead, Opportunity, Activity
- Core Content: trend summaries, stage distribution, overdue counts, workload by owner, conversion signals, and filter context.
- Permitted Actions: ACT_SEARCH_ACCOUNTS search_input_persistent
- Entry Points: direct_url, saved view, manager review workflow
- Exit And Guard Rules: drill-down returns to the same filtered insight context.
- Auth Required: true
- Design Guidance: charts must answer operational questions and lead to drill-down records.

### SURFACE: SURF_SETTINGS_AND_PREFERENCES
- Name: Settings and preferences
- Purpose: Let users adapt the CRM workflow without exposing irrelevant account filler.
- Data Entities Bound: Preference
- Core Content: saved views, default filters, notification preferences, team visibility, pipeline labels, and storage/status controls.
- Permitted Actions: ACT_SAVE_RECORD form_submit, ACT_RECOVER_STATE secondary_button
- Entry Points: direct_url, toolbar settings action
- Exit And Guard Rules: changes must show immediate visible effect or confirmation.
- Auth Required: true
- Design Guidance: settings should support CRM workflow only; no generic profile page.

### SURFACE: SURF_EMPTY_LOADING_AND_ERROR_RECOVERY
- Name: Empty, loading, and error recovery
- Purpose: Keep the app usable when data is absent, filtered away, failed to persist, or corrupt.
- Data Entities Bound: Account, Lead, Opportunity, Activity, Preference
- Core Content: clear cause, next action, retry/reset controls, sample seed option, and state-specific guidance.
- Permitted Actions: ACT_RECOVER_STATE primary_button
- Entry Points: failed load, empty database, empty filter, corrupted persistence
- Exit And Guard Rules: recovery returns to the active workflow and preserves unrelated state.
- Auth Required: false
- Design Guidance: recovery states must be useful product states, not blank placeholder panels.

## 5. Validation And Error Strategy
- Required fields cannot be saved when empty.
- Invalid email, number, date, enum, and stage-transition values show field-level or contextual feedback.
- Business-rule errors explain what must change before retry.
- System/network errors show retry and safe reset options without silently deleting user data.
- Empty states explain why the current collection is empty and what the next useful action is.

## 6. System Contracts
- Environment Needs: key names only; MC supplies values. No env secret values may appear in PLAN.
- Required Keys: [] unless external integrations are explicitly requested.
- External Integrations: none by default.
- Permission Model: owner can create/edit/reset; viewer can inspect/filter; anonymous access is allowed only for local-only demos.

## 7. Platform Contract
- Platform: web.
- Rendering Strategy: client-rendered Vite React SPA.
- Auth Storage: runtime-selected; if auth exists, avoid exposing secrets in browser state.
- Routing/Guard Location: client router or app state guards for surfaces; server auth is added only when MC provisions it.
- CSP Posture: standard.
- Stack Isolation: do not include Next.js SSR/App Router rules, React Native rules, Android/iOS rules, API-only endpoint contracts, or CLI command contracts.

## 8. Testability Contract
- Critical Path: search accounts, create/edit record, advance opportunity, clear filters, retry failed state, reset corrupted data, and save settings.
- Unhappy Variants: invalid required fields, invalid stage transition, empty filter result, persistence failure, and corrupted stored data.
- Test Handle Policy: Vite React may expose `data-testid` and a deterministic `window.app` bridge.
- Verification Method: visible UI assertions plus state bridge assertions for active surface, visible record count, selected record id, filters, errors, and action counters.

## 9. Out Of Scope
- No repo paths, branch names, GitHub URLs, run slugs, package names, or hardcoded directories.
- No physical screen table, screen-count field, or PLAN-invented route list.
- No ecommerce checkout, generic admin panel, documentation center, account profile filler, or marketing landing page.
- No fake controls that cannot be verified through state, data, navigation, or visible feedback.
