# English bullet typography admission

Actual source8e6 runaf743 completed PLAN3 after native feedback, then DESIGN4 rejected selected HTML with `DESIGN_SOURCE_SELECTED_HTML_ENGLISH_REQUIRED`, inner `ENGLISH_TEXT_NON_ASCII` for U+2022. Existing English admission already permits en/em dashes, smart quotes and ellipsis. A bullet is English UI punctuation, not a foreign-language letter. This rejection prevents the authorized working-software objective; this is a causal classifier correction, not a new product feature.

## Decision

Add only numeric code point `0x2022` to the existing `ALLOWED_ENGLISH_TYPOGRAPHY_V1` set. Keep raw HTML, encoding, byte/code-unit/tree limits, lexical checks, zero-width/control/non-English letter rejection and all native design/source/owner gates unchanged. Do not strip arbitrary Unicode, ignore violations or restore/replay failed af743. Local normalization only in the HTML caller would duplicate a common punctuation policy; broader Unicode categories would exceed observed need. Use the common existing policy.

## Acceptance and File Map

- `src/product-compiler/english-text-contract-v1.ts`: one additional permitted punctuation code point.
- `tests/product-compiler/english-text-contract-v1.test.ts`: genuine failing English plain/raw-HTML bullet examples, tree/lexical coverage, and mixed bullet+foreign/control/zero-width/localized-word rejection. Existing bounds and core rejection tests remain.
- This spec/plan records causal scope and proportional checks. Pure inspector regression RED then GREEN; full existing English contract test file, source no-emit, independent task/whole reviews, normal PR and stock clean-main build. No PG integration campaign is needed: HTML admission caller is unchanged and directly uses this inspector. Future fresh workflow is still required for composed qualification.

No live code/config/DB/provider/service effects or failed-case repair are part of this source task. Preserve original DESIGN artifact bytes and all records. A bullet error alone does not establish that the entire failed HTML meets every other contract.
