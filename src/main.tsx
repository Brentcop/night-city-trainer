import { createRoot } from 'react-dom/client';
import { App } from './App';
import { refreshSiteConfig } from './ui/useSiteConfig';
import './ui/fonts.css';
import './ui/styles.css';
import './ui/themes.css';
import './ui/motion.css';
import './ui/cards.css';
import './ui/hud.css';

createRoot(document.getElementById('root')!).render(<App />);
// the first paint used the config inlined at build time; the deployed file replaces it if it differs
void refreshSiteConfig();
