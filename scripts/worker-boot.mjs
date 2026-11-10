// Worker bootstrap: enable TypeScript via tsx, then load the real worker.
import { register } from 'tsx/esm/api';
register();
await import('./worker.ts');
