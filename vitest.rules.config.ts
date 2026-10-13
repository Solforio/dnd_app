import { defineConfig } from 'vitest/config';

// Security-rules tests: they need the Firestore emulator, so they run through
// `npm run test:rules` (firebase emulators:exec) and not with the unit tests.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
