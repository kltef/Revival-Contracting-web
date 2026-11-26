import { useCallback, useEffect, useState } from 'react';
import Requests from '../edit/Requests.jsx';
import { call } from '../edit/shared.js';
import { outputs } from '../amplify.js';

// The website is edited in place at /?edit; this tab links there, lists what's been sent,
// and connects Claude's website-edit routine (docs/website-edit-routine.md).

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  return (
    <div className="a-copy">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" className="a-btn ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

// 48 random letters and numbers, made in the browser; the backend only keeps a hash of it
function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ConnectClaude({ client }) {
  const hookUrl = outputs?.custom?.contentHookUrl;
  const [status, setStatus] = useState(null);
  const [fireUrl, setFireUrl] = useState('');
  const [fireToken, setFireToken] = useState('');
  const [shownKey, setShownKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(() => call(client, 'settings').then(setStatus, e => setError(e.message)), [client]);
  useEffect(() => { load(); }, [load]);

  const save = async (fields, done) => {
    setBusy(true); setError(''); setSaved('');
    try { setStatus(await call(client, 'saveSettings', fields)); done?.(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const makeKey = () => {
    if (status?.websiteKeySet && !confirm('Make a new website key? The old one stops working, so you’ll need to update the routine’s environment.')) return;
    const key = newKey();
    save({ websiteKey: key }, () => setShownKey(key));
  };
  const host = hookUrl ? new URL(hookUrl).host : '';
  const locked = status && !status.canChange;

  return (
    <div className="a-card a-connect">
      <div className="a-card-top">
        <h2>Connect Claude</h2>
        {status && <span className={'a-pill ' + (status.routineConnected && status.websiteKeySet ? 'ok' : 'warn')}>
          {status.routineConnected && status.websiteKeySet ? 'Connected' : 'Not connected yet'}</span>}
      </div>
      <p className="a-muted">Claude makes the website changes your family sends. Set up the routine at claude.ai/code/routines as described in <code>docs/website-edit-routine.md</code>, then connect it here. Until it’s connected, changes are saved and wait here.</p>
      {locked && <p className="a-note">These settings were connected by someone else, so only they can change them.</p>}
      {error && <p className="a-error" role="alert">{error}</p>}

      <h3>1. Website webhook</h3>
      {hookUrl ? <CopyField label="Address" value={hookUrl} />
        : <p className="a-muted">The webhook address appears here after the backend is deployed.</p>}

      <h3>2. Website key {status?.websiteKeySet && <span className="a-pill ok">Set</span>}</h3>
      <p className="a-muted">Claude uses this key to read change requests and report back. It’s shown only once.</p>
      {shownKey ? (
        <div className="a-keybox">
          <CopyField label="Website key" value={shownKey} />
          <p>In the routine’s environment on claude.ai, add a <b>network secret</b>: host <code>{host || 'the webhook address'}</code>, header <code>Authorization</code>, value <code>Bearer</code> followed by a space and this key.</p>
          <button type="button" className="a-btn ghost" onClick={() => setShownKey('')}>I’ve saved it</button>
        </div>
      ) : (
        <button type="button" className="a-btn" disabled={busy || locked} onClick={makeKey}>{status?.websiteKeySet ? 'Make a new website key' : 'Create the website key'}</button>
      )}

      <h3>3. Claude’s routine {status?.routineConnected && <span className="a-pill ok">Set</span>}</h3>
      <p className="a-muted">From the routine’s <b>API</b> trigger: its fire URL and token. Saved here, never shown again.</p>
      <form className="a-row" onSubmit={e => { e.preventDefault(); save({ fireUrl, fireToken }, () => { setFireUrl(''); setFireToken(''); setSaved('Saved.'); }); }}>
        <label>Fire URL<input value={fireUrl} onChange={e => setFireUrl(e.target.value)} placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire" disabled={locked} /></label>
        <label>Token<input type="password" value={fireToken} onChange={e => setFireToken(e.target.value)} placeholder={status?.routineConnected ? 'Saved (paste a new one to replace it)' : 'sk-ant-oat01-…'} autoComplete="off" disabled={locked} /></label>
        <button className="a-btn" disabled={busy || locked || !fireUrl.trim() || !fireToken.trim()}>Save</button>
      </form>
      {saved && <p className="a-muted" role="status">{saved}</p>}
    </div>
  );
}

export default function WebsiteTab({ client }) {
  return (
    <section>
      <div className="a-head">
        <h1>Website</h1>
        <p className="a-muted">Change the words and photos on your website by clicking on them.</p>
      </div>
      <div className="a-card a-editor-card">
        <div>
          <h2>Edit your website</h2>
          <p className="a-muted">Opens your website with editing turned on. Click any words to change them, or use <i>Change photo</i> on a photo. Nothing changes for visitors until you send your changes and they’re approved.</p>
        </div>
        <a className="a-btn a-btn-big" href="../?edit">Open the website editor</a>
      </div>
      <div className="a-card">
        <h2>Sent changes</h2>
        <Requests client={client} />
      </div>
      <ConnectClaude client={client} />
    </section>
  );
}
