const replacement = Buffer.from('[REDACTED_SUBSCRIPTION_CREDENTIAL]');

export interface SubscriptionCredentialRedactorV1 {
  push(chunk: Buffer): Buffer;
  finish(): Buffer;
  discard(): void;
  readonly redactions: number;
  readonly pendingBytes: number;
}

/** Exact finite spellings only; this is not a general exfiltration filter. */
export function createSubscriptionCredentialRedactorV1(credential: string): SubscriptionCredentialRedactorV1 {
  if (typeof credential !== 'string' || credential.length < 16 || credential.length > 4096
    || /[^\x21-\x7e]/.test(credential)) {
    throw new Error('SUBSCRIPTION_CREDENTIAL_INVALID');
  }

  const percent = encodeURIComponent(credential);
  const form = new URLSearchParams({ value: credential }).toString().slice('value='.length);
  const lowerPercent = (value: string): string => value.replace(/%[0-9A-F]{2}/g, part => part.toLowerCase());
  const base64 = Buffer.from(credential).toString('base64');
  const base64url = base64.replaceAll('+', '-').replaceAll('/', '_');
  const unicode = Array.from(credential, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  const unicodeUpper = unicode.replace(/\\u[0-9a-f]{4}/g, part => `\\u${part.slice(2).toUpperCase()}`);
  let variants = [...new Set([
    credential, JSON.stringify(credential).slice(1, -1),
    percent, lowerPercent(percent), form, lowerPercent(form),
    base64, base64.replace(/=+$/, ''), base64url, base64url.replace(/=+$/, ''),
    unicode, unicodeUpper,
  ])].map(value => Buffer.from(value)).sort((a, b) => b.length - a.length);

  if (variants.some(variant => replacement.includes(variant))) {
    for (const variant of variants) variant.fill(0);
    throw new Error('SUBSCRIPTION_CREDENTIAL_INVALID');
  }

  const longest = variants[0].length;
  let pending = Buffer.alloc(0);
  let closed = false;
  let redactions = 0;

  function clearVariants(): void {
    for (const variant of variants) variant.fill(0);
    variants = [];
  }

  function consume(data: Buffer, eof: boolean, output: Buffer[]): void {
    let cursor = 0;
    let runStart = 0;
    while (cursor < data.length && (eof || data.length - cursor >= longest)) {
      // Longest-first order resolves ties at this leftmost undecided position.
      const match = variants.find(variant => data[cursor] === variant[0]
        && data.subarray(cursor, cursor + variant.length).equals(variant));
      if (match) {
        if (cursor > runStart) output.push(Buffer.from(data.subarray(runStart, cursor)));
        output.push(replacement);
        cursor += match.length;
        runStart = cursor;
        redactions++;
      } else {
        cursor++;
      }
    }
    if (cursor > runStart) output.push(Buffer.from(data.subarray(runStart, cursor)));
    pending = Buffer.from(data.subarray(cursor));
    data.fill(0);
  }

  return {
    push(chunk: Buffer): Buffer {
      if (closed) throw new Error('SUBSCRIPTION_CREDENTIAL_REDACTOR_CLOSED');
      if (!Buffer.isBuffer(chunk)) throw new Error('SUBSCRIPTION_CREDENTIAL_INVALID');
      const output: Buffer[] = [];
      // Working storage is at most 2L-1; never concatenate a whole upstream chunk.
      for (let offset = 0; offset < chunk.length; offset += longest) {
        const slice = chunk.subarray(offset, offset + longest);
        const data = Buffer.allocUnsafe(pending.length + slice.length);
        pending.copy(data);
        slice.copy(data, pending.length);
        pending.fill(0);
        consume(data, false, output);
      }
      return Buffer.concat(output);
    },
    finish(): Buffer {
      if (closed) return Buffer.alloc(0);
      closed = true;
      const output: Buffer[] = [];
      const tail = pending;
      consume(tail, true, output);
      clearVariants();
      return Buffer.concat(output);
    },
    discard(): void {
      closed = true;
      pending.fill(0);
      pending = Buffer.alloc(0);
      clearVariants();
    },
    get redactions(): number { return redactions; },
    get pendingBytes(): number { return pending.length; },
  };
}
