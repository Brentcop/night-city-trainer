import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/styles.css';
import './ui/motion.css';
import './ui/cards.css';

createRoot(document.getElementById('root')!).render(<App />);
