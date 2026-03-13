/**
 * Test 1: Output Parsing — parseOutputKeyValues
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load compiled JS from dist
const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist/installer/context-ops.js');
const { parseOutputKeyValues } = await import(distPath);

let passed = 0, failed = 0;

function assert(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); console.log('    expected:', JSON.stringify(expected)); console.log('    actual:  ', JSON.stringify(actual)); }
}

console.log('Test 1: Output Parsing');
console.log('─'.repeat(40));

// 1. STATUS: done
const r1 = parseOutputKeyValues('STATUS: done\nREPO: ~/projects/test');
assert('STATUS: done parses correctly', r1.status, 'done');
assert('REPO parses correctly', r1.repo, '~/projects/test');

// 2. STATUS: fail
const r2 = parseOutputKeyValues('STATUS: fail\nERROR: something broke');
assert('STATUS: fail parses correctly', r2.status, 'fail');
assert('ERROR field present', r2.error, 'something broke');

// 3. STATUS: error
const r3 = parseOutputKeyValues('STATUS: error\nDETAIL: timeout');
assert('STATUS: error parses correctly', r3.status, 'error');

// 4. Multiline value
const r4 = parseOutputKeyValues('STATUS: done\nDESCRIPTION: line1\nline2\nline3\nREPO: /tmp/test');
assert('Multiline value joined', r4.description.includes('line2'), true);
assert('Key after multiline parsed', r4.repo, '/tmp/test');

// 5. Empty output
const r5 = parseOutputKeyValues('');
assert('Empty output → empty object', Object.keys(r5).length, 0);

// 6. JSON blob format
const r6 = parseOutputKeyValues(JSON.stringify({ STATUS: 'done', REPO: '/tmp/x', FILES_CHANGED: 'a.js, b.js' }));
assert('JSON blob STATUS', r6.status, 'done');
assert('JSON blob REPO', r6.repo, '/tmp/x');
assert('JSON blob FILES_CHANGED', r6.files_changed, 'a.js, b.js');

// 7. Mixed case keys
const r7 = parseOutputKeyValues('PR_URL: https://github.com/test/1\nSTORY_BRANCH: us-001');
assert('PR_URL parsed (lowercase key)', r7.pr_url, 'https://github.com/test/1');
assert('STORY_BRANCH parsed', r7.story_branch, 'us-001');

console.log('─'.repeat(40));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
