// Whether this browser belongs to someone who runs the site, worked out from what Amplify stores when
// someone signs in (keys like CognitoIdentityServiceProvider.<client>.LastAuthUser and
// CognitoIdentityServiceProvider.<client>.<user>.refreshToken, removed again on sign-out).
// The public site uses it to show admin links without loading any sign-in code.
//   'signedIn'  - signed in on this browser right now
//   'returning' - not signed in, but has signed in on this browser before (shows "Sign in")
//   'public'    - everyone else (shows nothing)
export const STAFF_MARK = 'revival-staff';
const PREFIX = 'CognitoIdentityServiceProvider.';

export function staffState(storage) {
  try {
    if (!storage) return 'public';
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(PREFIX) || !key.endsWith('.LastAuthUser')) continue;
      const client = key.slice(PREFIX.length, -'.LastAuthUser'.length);
      const user = storage.getItem(key);
      if (user && storage.getItem(`${PREFIX}${client}.${user}.refreshToken`)) {
        markStaff(storage);
        return 'signedIn';
      }
    }
    return storage.getItem(STAFF_MARK) ? 'returning' : 'public';
  } catch {
    return 'public'; // storage blocked (private mode, etc.)
  }
}

// Remember that someone who runs the site uses this browser
export function markStaff(storage = globalThis.localStorage) {
  try { storage?.setItem(STAFF_MARK, '1'); } catch { /* storage blocked */ }
}
