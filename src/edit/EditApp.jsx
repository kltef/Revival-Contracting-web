// Loaded only when the site is opened with ?edit (see src/main.jsx): sign in, then edit in place.
import { StrictMode } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
import '@aws-amplify/ui-react/styles.css';
import { outputs, hasBackend } from '../amplify.js';
import EditMode from './EditMode.jsx';
import './signin.css';

const exitHref = location.pathname + location.hash.replace(/^#?$/, '');
const upload = (key, blob) => uploadData({ path: key, data: blob, options: { contentType: 'image/jpeg' } }).result;

function Brand() {
  return (
    <div className="ed-signin-brand">
      <span className="tile"><span>R</span></span>
      <span><b>Revival</b> website editor</span>
    </div>
  );
}

export function mount(root) {
  if (!hasBackend) {
    root.render(
      <div className="ed-signin">
        <Brand />
        <h1>The editor isn’t connected yet</h1>
        <p>amplify_outputs.json is missing. Run <code>npx ampx sandbox</code> for local development, or open the editor on the deployed site.</p>
        <a href={exitHref}>Back to the website</a>
      </div>,
    );
    return;
  }
  Amplify.configure(outputs);
  const client = generateClient({ authMode: 'userPool' });
  root.render(
    <StrictMode>
      <Authenticator hideSignUp className="ed-signin-auth" components={{ Header: Brand }}>
        {({ signOut }) => <EditMode client={client} upload={upload} exitHref={exitHref} onSignOut={signOut} />}
      </Authenticator>
    </StrictMode>,
  );
}
