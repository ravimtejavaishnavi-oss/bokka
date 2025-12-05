// Utility functions for admin signup operations
// This implementation uses API calls to the server instead of direct database connections

interface AdminRequest {
  email: string;
  password: string;
  username: string;
  license_key: string;
}

/**
 * Insert a new admin signup request via API
 * @param request Admin request data
 */
export async function insertAdminRequest(request: Omit<AdminRequest, 'license_key'>): Promise<string> {
  try {
    const response = await fetch('/api/multitenant/admin/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit admin request');
    }

    const data = await response.json();
    return data.licenseKey;
  } catch (error) {
    console.error('Error inserting admin request:', error);
    throw new Error('Failed to submit admin request: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Verify a license key for an admin user via API
 * @param email Admin email
 * @param licenseKey License key to verify
 * @returns True if the license key is valid, false otherwise
 */
export async function verifyLicenseKey(email: string, licenseKey: string): Promise<boolean> {
  try {
    const response = await fetch('/api/multitenant/admin/requests/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, licenseKey }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to verify license key');
    }

    const data = await response.json();
    return data.valid;
  } catch (error) {
    console.error('Error verifying license key:', error);
    throw new Error('Failed to verify license key: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Get all admin requests (for account holders) via API
 * @returns Array of admin requests
 */
export async function getAllAdminRequests(): Promise<AdminRequest[]> {
  try {
    const response = await fetch('/api/multitenant/admin/requests');

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to retrieve admin requests');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting admin requests:', error);
    throw new Error('Failed to retrieve admin requests: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}