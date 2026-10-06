'use strict';

// Inert ABI sample, not a transport or protected-origin publisher.
if (process.argv.length !== 2) {
  process.stderr.write('cooperative initializer argv refused\n');
  process.exitCode = 2;
} else {
  // Loading/setup errors must never masquerade as callback refusal.
  const addon = require('./initializer.node');
  const keys = Reflect.ownKeys(addon);
  if (keys.length !== 1 || keys[0] !== 'initialize' ||
      typeof addon.initialize !== 'function') {
    process.stderr.write('cooperative initializer export refused\n');
    process.exitCode = 2;
  } else {
    try {
      addon.initialize();
      process.stderr.write('cooperative initializer returned without refusal\n');
      process.exitCode = 2;
    } catch (error) {
      if (!(error instanceof Error) ||
          error.code !== 'ORIGIN_COOPERATIVE_TRANSPORT_UNAVAILABLE' ||
          typeof error.message !== 'string') throw error;
      process.stderr.write(error.message + '\n');
      process.exitCode = 2;
    }
  }
}
