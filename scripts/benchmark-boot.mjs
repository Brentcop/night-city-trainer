// Worker bootstrap for the position benchmark: enable TypeScript via tsx, then load the benchmark worker.
import { register } from 'tsx/esm/api';
register();
await import('./benchmark-worker.ts');
