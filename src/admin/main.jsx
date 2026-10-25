import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { outputs } from '../amplify.js';
import '@aws-amplify/ui-react/styles.css';
import './admin.css';
import AdminApp from './AdminApp.jsx';

if (outputs) Amplify.configure(outputs);

createRoot(document.getElementById('root')).render(<StrictMode><AdminApp /></StrictMode>);
