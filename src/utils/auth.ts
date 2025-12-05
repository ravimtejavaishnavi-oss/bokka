// OAuth configuration and utilities
import { PublicClientApplication, Configuration, PopupRequest, AuthenticationResult } from '@azure/msal-browser';

export const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'c46508cc-63e8-44bb-bd44-f92c91dbffe2';
export const MICROSOFT_TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID || '0dab11d4-fd82-4365-8b7a-0640b4d18bd4';

// Microsoft Authentication Library (MSAL) configuration
// Configured for Web platform with authorization code flow + PKCE
export const msalConfig: Configuration = {
  auth: {
    clientId: MICROSOFT_CLIENT_ID,
    // Use specific tenant ID for single-tenant organization
    authority: 'https://login.microsoftonline.com/0dab11d4-fd82-4365-8b7a-0640b4d18bd4',
    redirectUri: import.meta.env.PROD 
      ? 'https://mango-moss-04cf10e03.2.azurestaticapps.net' 
      : 'http://localhost:5173',
    postLogoutRedirectUri: import.meta.env.PROD 
      ? 'https://mango-moss-04cf10e03.2.azurestaticapps.net' 
      : 'http://localhost:5173',
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true,
  },
  system: {
    windowHashTimeout: 60000,
    iframeHashTimeout: 60000,
    loadFrameTimeout: 60000,
    loggerOptions: {
      loggerCallback: (level: any, message: string, containsPii: boolean) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0: // Error
            console.error('[MSAL Error]', message);
            break;
          case 1: // Warning
            console.warn('[MSAL Warning]', message);
            break;
          case 2: // Info
            console.info('[MSAL Info]', message);
            break;
          case 3: // Verbose
            console.debug('[MSAL Debug]', message);
            break;
        }
      },
      piiLoggingEnabled: false,
      logLevel: 2 // Info level
    }
  }
};

// Initialize MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Microsoft OAuth configuration
export const microsoftAuthConfig = {
  client_id: MICROSOFT_CLIENT_ID,
  redirect_uri: import.meta.env.PROD 
    ? 'https://mango-moss-04cf10e03.2.azurestaticapps.net' 
    : 'http://localhost:5173',
  scope: 'openid email profile User.Read',
  response_type: 'code',
  response_mode: 'query'
};

// Microsoft login request parameters (using popup flow)
// Only requesting User.Read as configured in Azure AD
export const msalLoginRequest: PopupRequest = {
  scopes: ['User.Read'],
  prompt: 'select_account'
};

// Microsoft login request for admin with enhanced permissions (using popup flow)
// Only requesting User.Read as configured in Azure AD
export const msalAdminLoginRequest: PopupRequest = {
  scopes: ['User.Read'],
  prompt: 'select_account'
};


// Generate Microsoft OAuth URL
export const getMicrosoftAuthUrl = (): string => {
  const baseUrl = 'https://login.microsoftonline.com/53be55ec-4183-4a38-8c83-8e6e12e2318a/oauth2/v2.0/authorize';
  const params = new URLSearchParams({
    client_id: microsoftAuthConfig.client_id,
    redirect_uri: microsoftAuthConfig.redirect_uri,
    scope: microsoftAuthConfig.scope,
    response_type: microsoftAuthConfig.response_type,
    response_mode: microsoftAuthConfig.response_mode
  });
  
  const tenant = MICROSOFT_TENANT_ID || 'common';
  const safeBase = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
  return `${safeBase}?${params.toString()}`;
};


// Create OAuth popup window synchronously
export const createOAuthPopup = (name: string): Window | null => {
  return window.open(
    'about:blank',
    name,
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );
};

// Handle OAuth popup messages
export const handleOAuthPopupMessages = (popup: Window, url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new Error('Popup blocked'));
      return;
    }

    // Navigate to the OAuth URL
    popup.location.href = url;

    // Check if popup is closed
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error('Authentication cancelled'));
      }
    }, 1000);

    // Listen for messages from popup
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_SUCCESS') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        popup.close();
        resolve(event.data.user);
      } else if (event.data.type === 'OAUTH_ERROR') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        popup.close();
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageListener);
  });
};



// Check if user has AI Administrator role
export const checkUserRole = async (accessToken: string): Promise<boolean> => {
  try {
    console.log('Checking user roles...');
    
    // Get user's directory roles from Microsoft Graph
    const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch user roles:', response.status, response.statusText);
      return false;
    }
    
    const data = await response.json();
    console.log('User roles data:', data);
    
    // Check if user has AI Administrator role
    const hasAIAdminRole = data.value?.some((role: any) => 
      role.displayName === 'AI Administrator' || 
      role.roleName === 'AI Administrator' ||
      role.description?.includes('AI Administrator')
    );
    
    console.log('User has AI Administrator role:', hasAIAdminRole);
    return hasAIAdminRole;
  } catch (error) {
    console.error('Error checking user roles:', error);
    return false;
  }
};

// Handle Microsoft admin login with popup flow
export const handleMicrosoftAdminLogin = async (): Promise<any> => {
  try {
    console.log('Starting Microsoft admin login with popup...');
    
    // Initialize MSAL instance if not already done
    await msalInstance.initialize();
    console.log('MSAL initialized');
    
    // Check if user is already logged in
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      console.log('User already logged in, using existing account');
      msalInstance.setActiveAccount(accounts[0]);
      return {
        id: accounts[0].localAccountId || accounts[0].homeAccountId,
        name: accounts[0].name || accounts[0].username || 'Microsoft User',
        email: accounts[0].username,
        provider: 'microsoft'
      };
    }
    
    console.log('Starting popup login with admin request:', msalAdminLoginRequest);
    
    // Use popup flow - simpler and more reliable
    const response = await msalInstance.loginPopup(msalAdminLoginRequest);
    
    if (response && response.account) {
      msalInstance.setActiveAccount(response.account);
      console.log('Microsoft admin popup login successful:', response.account);
      
      return {
        id: response.account.localAccountId || response.account.homeAccountId,
        name: response.account.name || response.account.username || 'Microsoft User',
        email: response.account.username,
        provider: 'microsoft',
        accessToken: response.accessToken
      };
    }
    
    throw new Error('No account information received');
  } catch (error) {
    console.error('Microsoft admin login error details:', error);
    
    // Handle specific MSAL errors
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.message.includes('user_cancelled') || error.message.includes('User cancelled')) {
        throw new Error('Login was cancelled by the user');
      } else if (error.message.includes('popup_window_error') || error.message.includes('popup')) {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.message.includes('consent_required')) {
        throw new Error('Additional permissions required. Please contact your administrator.');
      }
    }
    
    // Re-throw with more context
    throw new Error(`Microsoft admin authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
// Handle Microsoft login with popup flow (simpler and more reliable)
export const handleMicrosoftLogin = async (): Promise<any> => {
  try {
    console.log('Starting Microsoft login with popup...');
    
    // Initialize MSAL instance if not already done
    await msalInstance.initialize();
    console.log('MSAL initialized');
    
    // Check if user is already logged in
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      console.log('User already logged in, using existing account');
      msalInstance.setActiveAccount(accounts[0]);
      return {
        id: accounts[0].localAccountId || accounts[0].homeAccountId,
        name: accounts[0].name || accounts[0].username || 'Microsoft User',
        email: accounts[0].username,
        provider: 'microsoft'
      };
    }
    
    console.log('Starting popup login with request:', msalLoginRequest);
    
    // Use popup flow - simpler and more reliable
    const response = await msalInstance.loginPopup(msalLoginRequest);
    
    if (response && response.account) {
      msalInstance.setActiveAccount(response.account);
      console.log('Microsoft popup login successful:', response.account);
      
      return {
        id: response.account.localAccountId || response.account.homeAccountId,
        name: response.account.name || response.account.username || 'Microsoft User',
        email: response.account.username,
        provider: 'microsoft',
        accessToken: response.accessToken
      };
    }
    
    throw new Error('No account information received');
  } catch (error) {
    console.error('Microsoft login error details:', error);
    
    // Handle specific MSAL errors
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.message.includes('user_cancelled') || error.message.includes('User cancelled')) {
        throw new Error('Login was cancelled by the user');
      } else if (error.message.includes('popup_window_error') || error.message.includes('popup')) {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.message.includes('consent_required')) {
        throw new Error('Additional permissions required. Please contact your administrator.');
      }
    }
    
    // Re-throw with more context
    throw new Error(`Microsoft authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Legacy Microsoft login method using redirect URL
export const handleMicrosoftLoginLegacy = async (popup?: Window): Promise<any> => {
  try {
    const authUrl = getMicrosoftAuthUrl();
    const popupWindow = popup || createOAuthPopup('microsoft-login');
    if (!popupWindow) {
      throw new Error('Popup blocked');
    }
    const user = await handleOAuthPopupMessages(popupWindow, authUrl);
    return user;
  } catch (error) {
    console.error('Microsoft login error:', error);
    throw error;
  }
};

// Handle Microsoft redirect callback
export const handleMicrosoftRedirectCallback = async (): Promise<any> => {
  try {
    console.log('Handling Microsoft redirect callback...');
    
    // Initialize MSAL instance if not already done
    await msalInstance.initialize();
    
    // Handle the redirect response
    const response = await msalInstance.handleRedirectPromise();
    
    if (response && response.account) {
      // Set the active account
      msalInstance.setActiveAccount(response.account);
      
      console.log('Microsoft redirect login successful:', response.account);
      
      // Extract user information from the account
      const account = response.account;
      const user = {
        id: account.localAccountId || account.homeAccountId,
        name: account.name || account.username || 'Microsoft User',
        email: account.username || account.environment,
        picture: null,
        tenantId: account.tenantId,
        provider: 'microsoft',
        accessToken: response.accessToken
      };
      
      console.log('Extracted user data:', user);
      
      // Validate that we have essential information
      if (!user.email) {
        console.error('No email found in Microsoft account');
        throw new Error('Unable to get email from Microsoft account. Please ensure your account has an email address.');
      }
      
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('Microsoft redirect callback error:', error);
    throw error;
  }
};

// Handle Microsoft logout with redirect
export const handleMicrosoftLogout = async (): Promise<void> => {
  try {
    await msalInstance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin
    });
  } catch (error) {
    console.error('Microsoft logout error:', error);
    // Clear the session storage as fallback
    msalInstance.clearCache();
  }
};

// Check if user is logged in with Microsoft
export const isLoggedInWithMicrosoft = (): boolean => {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0;
};

// Get current Microsoft user
export const getCurrentMicrosoftUser = (): any | null => {
  const account = msalInstance.getActiveAccount();
  if (account) {
    return {
      id: account.localAccountId,
      name: account.name || account.username,
      email: account.username,
      picture: null,
      tenantId: account.tenantId,
      provider: 'microsoft'
    };
  }
  return null;
};