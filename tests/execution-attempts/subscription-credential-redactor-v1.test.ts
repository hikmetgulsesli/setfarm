import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSubscriptionCredentialRedactorV1 } from '../../src/execution/subscription-credential-redactor-v1.js';

const key = 'fake-subscription-A+/09';
const marker = '[REDACTED_SUBSCRIPTION_CREDENTIAL]';

// Whole-buffer oracle: independent spelling derivation and candidate search,
// with no production helpers or streaming algorithm shared with the subject.
function spellings(credential: string): Buffer[] {
  const percent = (form: boolean, lower: boolean): string => Array.from(credential, char => {
    const safe = form ? /^[A-Za-z0-9*._-]$/ : /^[A-Za-z0-9!'()*._~-]$/;
    if (safe.test(char)) return char;
    if (form && char === ' ') return '+';
    const hex = char.charCodeAt(0).toString(16).padStart(2, '0');
    return `%${lower ? hex : hex.toUpperCase()}`;
  }).join('');
  const base64 = Buffer.from(credential).toString('base64');
  const url64 = base64.replaceAll('+', '-').replaceAll('/', '_');
  const unicode = (upper: boolean): string => Array.from(credential, char => {
    const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${upper ? hex.toUpperCase() : hex}`;
  }).join('');
  return [...new Set([
    credential, JSON.stringify(credential).slice(1, -1),
    percent(false, false), percent(false, true), percent(true, false), percent(true, true),
    base64, base64.replace(/=+$/, ''), url64, url64.replace(/=+$/, ''),
    unicode(false), unicode(true),
  ])].map(value => Buffer.from(value));
}

function reference(credential: string, source: Buffer): { output: Buffer; count: number } {
  const variants = spellings(credential);
  const output: Buffer[] = [];
  let cursor = 0;
  let count = 0;
  while (cursor < source.length) {
    let start = source.length;
    let match: Buffer | undefined;
    for (const variant of variants) {
      const position = source.indexOf(variant, cursor);
      if (position !== -1 && (position < start || (position === start && variant.length > (match?.length ?? 0)))) {
        start = position;
        match = variant;
      }
    }
    output.push(source.subarray(cursor, start));
    if (!match) break;
    output.push(Buffer.from(marker));
    cursor = start + match.length;
    count++;
  }
  return { output: Buffer.concat(output), count };
}

function checkPartitions(credential: string, source: Buffer, sizes: readonly number[]): void {
  const expected = reference(credential, source);
  const longest = Math.max(...spellings(credential).map(value => value.length));
  const redactor = createSubscriptionCredentialRedactorV1(credential);
  const output: Buffer[] = [];
  let cursor = 0;
  for (const size of sizes) {
    output.push(redactor.push(source.subarray(cursor, cursor + size)));
    cursor += size;
    assert.ok(redactor.pendingBytes <= longest - 1, 'pending storage exceeded lookahead bound');
  }
  assert.equal(cursor, source.length);
  output.push(redactor.finish());
  assert.deepEqual(Buffer.concat(output), expected.output);
  assert.equal(redactor.redactions, expected.count);
  assert.equal(redactor.pendingBytes, 0);
}

test('raw key across every split is filtered before completion', () => {
  const source = Buffer.from(`before:${key}:after`);
  for (let split = 0; split <= source.length; split++) {
    const r = createSubscriptionCredentialRedactorV1(key);
    const output = Buffer.concat([r.push(source.subarray(0, split)), r.push(source.subarray(split)), r.finish()]);
    assert.equal(output.toString(), `before:${marker}:after`);
    assert.equal(r.redactions, 1);
    assert.equal(r.pendingBytes, 0);
  }
});

test('oracle spelling fixtures include distinct JSON, percent, form and base64url encodings', () => {
  const values = spellings('fake-"quote\\A+/?~!').map(value => value.toString());
  assert.ok(values.includes('fake-\\"quote\\\\A+/?~!'));
  assert.ok(values.includes('fake-%22quote%5CA%2B%2F%3F~!'));
  assert.ok(values.includes('fake-%22quote%5cA%2b%2f%3f~!'));
  assert.ok(values.includes('fake-%22quote%5CA%2B%2F%3F%7E%21'));
  assert.ok(spellings(key).some(value => value.toString() === 'ZmFrZS1zdWJzY3JpcHRpb24tQSsvMDk='));
  assert.ok(spellings('~~~~~~~~~~~~~~~?').some(value => value.toString() === 'fn5-fn5-fn5-fn5-fn5-Pw=='));
});

test('every complete spelling is redacted once at every split and byte at a time', () => {
  for (const credential of [key, 'fake-"quote\\A+/?~!', '~~~~~~~~~~~~~~~?']) {
    for (const variant of spellings(credential)) {
      const source = Buffer.concat([Buffer.from('before:'), variant, Buffer.from(':after')]);
      assert.deepEqual(reference(credential, source), { output: Buffer.from(`before:${marker}:after`), count: 1 });
      for (let split = 0; split <= source.length; split++) {
        checkPartitions(credential, source, [split, source.length - split]);
      }
      checkPartitions(credential, source, Array(source.length).fill(1));
    }
  }
});

test('deterministic mixed partitions preserve binary nonmatches and adjacent variants', () => {
  const source = Buffer.concat([
    Buffer.from([0, 255, 195, 40]),
    ...spellings(key).flatMap(value => [value, value, Buffer.from('||')]),
    Buffer.from([128, 254, 10, 13]),
  ]);
  const sizes: number[] = [0];
  let cursor = 0;
  let seed = 19;
  while (cursor < source.length) {
    seed = (seed * 48271) % 2147483647;
    const size = Math.min(1 + seed % 73, source.length - cursor);
    sizes.push(size, 0);
    cursor += size;
  }
  checkPartitions(key, source, sizes);
});

test('overlap uses leftmost match and duplicate spellings count once', () => {
  const credential = 'abababababababab';
  const source = Buffer.from(`ab${credential}${credential}ab`);
  checkPartitions(credential, source, Array(source.length).fill(1));
  assert.equal(reference(credential, source).output.toString(), `${marker}${marker}abab`);
  const duplicate = createSubscriptionCredentialRedactorV1('abcdefghijklmnop');
  assert.equal(Buffer.concat([duplicate.push(Buffer.from('abcdefghijklmnop')), duplicate.finish()]).toString(), marker);
  assert.equal(duplicate.redactions, 1);
});

test('EOF inspects complete matches and preserves every incomplete spelling tail', () => {
  for (const variant of spellings(key)) {
    for (let end = 0; end <= variant.length; end++) {
      const source = variant.subarray(0, end);
      checkPartitions(key, source, [source.length]);
    }
  }
});

test('near matches preserve bytes around changed, missing and extra characters', () => {
  const source = Buffer.from([
    key.slice(0, -1), `X${key.slice(1)}`, `${key.slice(0, 8)}!${key.slice(8)}`,
    key.toUpperCase(), '%66ake-subscription-A%2B%2F09', 'unrelated π text',
  ].join('|'));
  assert.equal(reference(key, source).count, 0);
  checkPartitions(key, source, Array(source.length).fill(1));
});

test('abort discards withheld bytes, closes input and never flushes them', () => {
  const redactor = createSubscriptionCredentialRedactorV1(key);
  assert.equal(redactor.push(Buffer.from(key.slice(0, -1))).length, 0);
  assert.equal(redactor.pendingBytes, key.length - 1);
  redactor.discard();
  assert.equal(redactor.pendingBytes, 0);
  assert.equal(redactor.redactions, 0);
  assert.equal(redactor.finish().length, 0);
  redactor.discard();
  assert.throws(() => redactor.push(Buffer.alloc(0)), { message: 'SUBSCRIPTION_CREDENTIAL_REDACTOR_CLOSED' });
});

test('empty pushes and repeated finish neither duplicate nor lose output', () => {
  const redactor = createSubscriptionCredentialRedactorV1(key);
  assert.equal(redactor.push(Buffer.alloc(0)).length, 0);
  assert.equal(redactor.push(Buffer.from('tail')).length, 0);
  assert.equal(redactor.push(Buffer.alloc(0)).length, 0);
  assert.equal(redactor.finish().toString(), 'tail');
  assert.equal(redactor.finish().length, 0);
  assert.equal(redactor.pendingBytes, 0);
  assert.throws(() => redactor.push(Buffer.from('later')), { message: 'SUBSCRIPTION_CREDENTIAL_REDACTOR_CLOSED' });
});

test('invalid credentials and marker collisions fail without echoing supplied data', () => {
  const invalid: unknown[] = [undefined, null, 123, Buffer.from(key), {}, '', 'x'.repeat(15), 'x'.repeat(4097),
    `${key}\n`, `${key}\r`, `${key}\t`, `${key} `, `${key}\0`, `${key}\x1f`, `${key}\x7f`, `${key}é`,
    'REDACTED_SUBSCRIPTION', marker];
  for (const value of invalid) {
    assert.throws(() => createSubscriptionCredentialRedactorV1(value as string), {
      message: 'SUBSCRIPTION_CREDENTIAL_INVALID',
    });
  }
});

test('minimum and maximum visible ASCII credentials are accepted and filtered', () => {
  for (const credential of ['0123456789abcdef', '!'.repeat(4096)]) {
    const source = Buffer.from(credential);
    checkPartitions(credential, source, [source.length]);
    assert.equal(reference(credential, source).output.toString(), marker);
  }
});

test('large upstream chunks preserve nonmatches without retaining the upstream buffer', () => {
  const prefix = Buffer.alloc(1024 * 1024, 255);
  const suffix = Buffer.alloc(1024 * 1024, 128);
  const source = Buffer.concat([prefix, Buffer.from(key), suffix]);
  const redactor = createSubscriptionCredentialRedactorV1(key);
  const emitted = redactor.push(source);
  assert.ok(redactor.pendingBytes <= 6 * key.length - 1);
  source.fill(0);
  assert.deepEqual(Buffer.concat([emitted, redactor.finish()]), Buffer.concat([prefix, Buffer.from(marker), suffix]));
  assert.equal(redactor.redactions, 1);
});
