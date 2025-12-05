import React, { useEffect } from 'react';
import { MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID } from '../utils/microsoftConfig';

interface OAuthCallbackProps {
  provider: 'google' | 'microsoft' | 'yahoo';
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({ provider }) => {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (provider === 'microsoft') {
          // Handle direct OAuth callback (not MSAL)
          const { extractAuthorizationCode, clearAuthData } = await import('../utils/directMicrosoftAuth');
          
          const code = extractAuthorizationCode();
          // Check localStorage (not sessionStorage) - AdminLogin sets it in localStorage
          const isAdminLogin = localStorage.getItem('is_admin_login') === 'true';
          
          if (!code) {
            throw new Error('No authorization code received from Microsoft');
          }
          
          console.log('Authorization code received, exchanging for token...');
          console.log('Is Admin Login:', isAdminLogin);
          
          // Send authorization code to backend for token exchange
          const backendUrl = import.meta.env.PROD 
            ? 'https://aiva-backend-prod-app.azurewebsites.net'
            : 'http://localhost:3001';
          
          const response = await fetch(`${backendUrl}/api/auth/microsoft/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: code,
              redirectUri: import.meta.env.PROD 
                ? 'https://mango-moss-04cf10e03.2.azurestaticapps.net/auth/microsoft/callback' 
                : 'http://localhost:5173/auth/microsoft/callback'
            }),
          });

          if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token exchange successful!');
            console.log('User role:', userData.user?.role || userData.role);
            console.log('Is admin login:', isAdminLogin);
            
            // Get user role
            const userRole = userData.user?.role || userData.role;
            
            // Clear auth data AFTER checking it
            clearAuthData();
            localStorage.removeItem('is_admin_login');
            
            // Determine if this is an admin login
            // Admin if: (explicitly clicked admin login) OR (user has admin role)
            const isAdmin = isAdminLogin || userRole === 'admin';
            
            // Store authentication
            if (isAdmin) {
              console.log('Setting admin authentication...');
              localStorage.setItem('adminAuthenticated', 'true');
              localStorage.setItem('isAuthenticated', 'true');
              localStorage.setItem('user', JSON.stringify(userData));
              localStorage.setItem('authToken', userData.token);
              console.log('✅ Admin auth set, redirecting to admin dashboard...');
              window.location.href = '/admin/dashboard';
            } else {
              console.log('Setting user authentication...');
              localStorage.setItem('isAuthenticated', 'true');
              localStorage.setItem('user', JSON.stringify(userData));
              localStorage.setItem('authToken', userData.token);
              console.log('✅ User auth set, redirecting to dashboard...');
              window.location.href = '/dashboard';
            }
          } else {
            // Handle error responses
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              // If response is not JSON, use status text
              errorData = { 
                error: 'Authentication failed',
                message: response.statusText || 'Failed to authenticate with backend'
              };
            }

            // Check if this is an access denied / pending approval error (403)
            if (response.status === 403) {
              const errorMessage = errorData.message || errorData.error || 'Your account does not have access. Please contact your administrator.';
              const errorType = errorData.requiresApproval || errorData.message?.toLowerCase().includes('approval') || errorData.message?.toLowerCase().includes('pending')
                ? 'access_denied'
                : 'access_denied';
              
              // Persist message so Login page can always show it
              try {
                localStorage.setItem('pendingAuthError', errorMessage);
                localStorage.setItem('pendingAuthErrorType', errorType);
              } catch {}
              
              // Redirect to login with specific error message
              window.location.href = `/login?error=${encodeURIComponent(errorMessage)}&type=${errorType}`;
              return;
            }
            
            // For other errors (401, 500, etc.), also redirect with error
            const errorMessage = errorData.message || errorData.error || `Authentication failed (${response.status})`;
            try {
              localStorage.setItem('pendingAuthError', errorMessage);
              localStorage.setItem('pendingAuthErrorType', 'auth_error');
            } catch {}
            window.location.href = `/login?error=${encodeURIComponent(errorMessage)}&type=auth_error`;
            return;
          }
        } else {
          // Handle other providers (Google, Yahoo) with popup flow
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const error = urlParams.get('error');

          if (error) {
            // Send error to parent window
            window.opener?.postMessage({
              type: 'OAUTH_ERROR',
              error: error
            }, window.location.origin);
            return;
          }

          if (code) {
            // For Microsoft authentication, include the client ID and tenant ID
            const requestBody = provider === 'microsoft' 
              ? { 
                  code, 
                  clientId: MICROSOFT_CLIENT_ID,
                  tenantId: MICROSOFT_TENANT_ID
                }
              : { code };
              
            // Exchange code for tokens (this would typically be done on your backend)
            const response = await fetch(`/api/auth/${provider}/callback`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (response.ok) {
              const userData = await response.json();
              // Send success to parent window
              window.opener?.postMessage({
                type: 'OAUTH_SUCCESS',
                user: userData
              }, window.location.origin);
            } else {
              throw new Error('Failed to authenticate');
            }
          }
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        // Extract meaningful error message
        let errorMessage = 'Authentication failed';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Check for network errors
          if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
          }
        }
        
        // Redirect to login page with error and type
        window.location.href = `/login?error=${encodeURIComponent(errorMessage)}&type=auth_error`;
      }
    };

    handleCallback();
  }, [provider]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-white text-lg">Completing authentication...</p>
        <p className="text-slate-400 text-sm mt-2">Please wait while we sign you in.</p>
      </div>
    </div>
  );
};

export default OAuthCallback;