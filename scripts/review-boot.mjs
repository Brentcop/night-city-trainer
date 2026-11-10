// Worker bootstrap for scripts/review.ts: enable TypeScript via tsx, then load the review worker.
import { register } from 'tsx/esm/api';
register();
await import('./review-worker.ts');
