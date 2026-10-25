import { useMemo, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { hasBackend } from '../amplify.js';
import GalleryManager from './GalleryManager.jsx';
import Submissions from './Submissions.jsx';

const Brand = () => (
  <div className="a-brand">
    <span className="a-tile">R</span>
    <span><b>Revival</b> admin</span>
  </div>
);

const TABS = [['gallery', 'Gallery'], ['estimates', 'Estimate requests'], ['reviews', 'Reviews']];

function Dashboard({ user, signOut }) {
  const client = useMemo(() => generateClient({ authMode: 'userPool' }), []);
  const [tab, setTab] = useState('gallery');
  return (
    <div className="a-shell">
      <header className="a-top">
        <Brand />
        <div className="a-user">
          <a href="../">View site</a>
          <span className="a-muted">{user?.signInDetails?.loginId}</span>
          <button type="button" className="a-btn ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <nav className="a-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>
      <main className="a-main">
        {tab === 'gallery' && <GalleryManager client={client} />}
        {tab === 'estimates' && <Submissions client={client} kind="estimates" />}
        {tab === 'reviews' && <Submissions client={client} kind="reviews" />}
      </main>
    </div>
  );
}

export default function AdminApp() {
  if (!hasBackend) {
    return (
      <div className="a-shell a-center">
        <Brand />
        <h1>Backend not connected</h1>
        <p className="a-muted">amplify_outputs.json is missing. Run <code>npx ampx sandbox</code> for local development, or deploy the site with Amplify Hosting.</p>
      </div>
    );
  }
  return (
    <Authenticator hideSignUp components={{ Header: () => <div className="a-auth-head"><Brand /></div> }}>
      {({ user, signOut }) => <Dashboard user={user} signOut={signOut} />}
    </Authenticator>
  );
}
