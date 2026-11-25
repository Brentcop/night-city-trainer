// Worker bootstrap for scripts/review-validity.ts: enable TypeScript via tsx, then load its worker.
import { register } from 'tsx/esm/api';
register();
await import('./review-validity-worker.ts');
