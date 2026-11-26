import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './site/App.jsx';

const root = createRoot(document.getElementById('root'));

// /?edit opens the inline website editor. Its code (and the sign-in) is a separate download
// that visitors never load.
if (new URLSearchParams(location.search).has('edit')) {
  import('./edit/EditApp.jsx').then(m => m.mount(root));
} else {
  root.render(<StrictMode><App /></StrictMode>);
}
