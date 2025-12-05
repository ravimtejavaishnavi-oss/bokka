// Direct Microsoft OAuth 2.0 flow for Web platform
// Bypasses MSAL.js to work with Web platform configuration

const MICROSOFT_CLIENT_ID = '880864d4-94d0-402e-a1ec-169563e2503c';
const MICROSOFT_TENANT_ID = '0dab11d4-fd82-4365-8b7a-0640b4d18bd4';
const REDIRECT_URI = import.meta.env.PROD 
  ? 'https://mango-moss-04cf10e03.2.azurestaticapps.net' 
  : 'http://localhost:5173';

// Generate PKCE code verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
}

// Store code verifier in localStorage (more reliable across redirects)
function storeCodeVerifier(verifier: string): void {
  localStorage.setItem('pkce_code_verifier', verifier);
}

function getCodeVerifier(): string | null {
  return localStorage.getItem('pkce_code_verifier');
}

function clearCodeVerifier(): void {
  localStorage.removeItem('pkce_code_verifier');
}

// Direct OAuth login - opens Microsoft login in current window
// NOTE: For Web platform with client_secret, we DON'T use PKCE
// PKCE is only for public clients (SPA without secrets)
export async function loginWithMicrosoft(): Promise<void> {
  try {
    console.log('=== MICROSOFT OAUTH LOGIN (Web Platform) ===');
    console.log('Client ID:', MICROSOFT_CLIENT_ID);
    console.log('Redirect URI:', REDIRECT_URI);
    
    // Store the intended redirect location
    localStorage.setItem('auth_redirect_after_login', window.location.pathname);
    
    // Build authorization URL WITHOUT PKCE
    // Since we're using Web platform with client_secret on backend
    const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`);
    authUrl.searchParams.append('client_id', MICROSOFT_CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', 'User.Read openid profile email');
    authUrl.searchParams.append('response_mode', 'query');
    authUrl.searchParams.append('prompt', 'select_account');
    
    console.log('Redirecting to Microsoft login (WITHOUT PKCE - using client_secret instead)...');
    console.log('Authorization URL:', authUrl.toString());
    
    // Redirect to Microsoft login
    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('Error initiating Microsoft login:', error);
    throw error;
  }
}

// Handle callback - extract authorization code
export function extractAuthorizationCode(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');
  
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    throw new Error(errorDescription || error);
  }
  
  return code;
}

// Get code verifier for token exchange
export function getStoredCodeVerifier(): string | null {
  return getCodeVerifier();
}

// Clear auth data
export function clearAuthData(): void {
  clearCodeVerifier();
  localStorage.removeItem('auth_redirect_after_login');
}

// Get intended redirect location
export function getIntendedRedirect(): string {
  return localStorage.getItem('auth_redirect_after_login') || '/dashboard';
}

