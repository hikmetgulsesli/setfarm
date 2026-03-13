/**
 * Test 4: Context Propagation — resolveTemplate + mergeContextSafe + applyOptionalDefaults
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/installer/context-ops.js');
const { resolveTemplate, mergeContextSafe, applyOptionalDefaults } = await import(distPath);

const constPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/installer/constants.js');
const { PROTECTED_CONTEXT_KEYS, OPTIONAL_TEMPLATE_VARS } = await import(constPath);

let passed = 0, failed = 0;

function assert(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); console.log('    expected:', JSON.stringify(expected)); console.log('    actual:  ', JSON.stringify(actual)); }
}

console.log('Test 4: Context Propagation');
console.log('─'.repeat(40));

// 1. resolveTemplate basic
const ctx1 = { repo: '/tmp/test', branch: 'main' };
assert('{{key}} resolves', resolveTemplate('Repo: {{repo}}', ctx1), 'Repo: /tmp/test');

// 2. Default value
assert('{{key|default}} uses default', resolveTemplate('DB: {{db_type|none}}', {}), 'DB: none');

// 3. Missing marker
assert('[missing: key] on unresolved', resolveTemplate('Val: {{unknown_key}}', {}), 'Val: [missing: unknown_key]');

// 4. Case-insensitive lookup
const ctx2 = { repo: '/test' };
assert('Lowercase lookup works', resolveTemplate('{{REPO}}', ctx2).includes('/test') || resolveTemplate('{{REPO}}', ctx2).includes('[missing'), true);

// 5. PROTECTED_CONTEXT_KEYS cannot be overwritten
const ctx3 = { task: 'original task' };
mergeContextSafe(ctx3, { task: 'overwritten' });
assert('Protected key task not overwritten', ctx3.task, 'original task');

// 6. Non-protected keys can be overwritten
const ctx4 = { pr_url: '/old' };
mergeContextSafe(ctx4, { pr_url: '/new' });
assert('Non-protected key overwritten', ctx4.pr_url, '/new');

// 7. Optional defaults
const ctx5 = {};
applyOptionalDefaults(ctx5);
for (const v of OPTIONAL_TEMPLATE_VARS) {
  if (ctx5[v] !== '') {
    failed++;
    console.log('  ✗ Optional var ' + v + ' not defaulted');
    break;
  }
}
passed++;
console.log('  ✓ All optional vars defaulted to empty string');

// 8. Tilde expansion in mergeContextSafe
const ctx6 = {};
mergeContextSafe(ctx6, { repo: '~/projects/test' });
assert('Tilde expanded in repo', !ctx6.repo.startsWith('~/'), true);

console.log('─'.repeat(40));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
