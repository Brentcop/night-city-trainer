// The site's knowledge-pack manifest, made by the `nct-kb-site` plugin in vite.config.ts (docs/RAG_PLAN.md step 3).
declare module 'virtual:nct-kb-site' {
  const manifest: import('../lib/kb/site').SiteManifest;
  export default manifest;
}
