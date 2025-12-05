// API functions for admin signup operations
// This implementation uses API calls to the server

import {
  insertAdminRequest as insertAdminRequestAPI,
  verifyLicenseKey as verifyLicenseKeyAPI,
  getAllAdminRequests as getAllAdminRequestsAPI
} from './adminDatabase';

/**
 * Submit an admin signup request
 * @param username Admin username
 * @param email Admin email
 * @param password Admin password
 * @returns Promise that resolves with the generated license key
 */
export async function submitAdminRequest(username: string, email: string, password: string): Promise<string> {
  try {
    // Call the API function
    const licenseKey = await insertAdminRequestAPI({ username, email, password });
    console.log('Admin request submitted successfully with license key:', licenseKey);
    return licenseKey;
  } catch (error) {
    console.error('Error submitting admin request:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to submit admin request');
  }
}

/**
 * Verify a license key
 * @param email Admin email
 * @param licenseKey License key to verify
 * @returns Promise that resolves when the license key is verified
 */
export async function verifyLicenseKey(email: string, licenseKey: string): Promise<void> {
  try {
    // Call the API function
    const isValid = await verifyLicenseKeyAPI(email, licenseKey);
    
    if (!isValid) {
      throw new Error('Invalid license key');
    }
    
    console.log('License key verified successfully');
  } catch (error) {
    console.error('Error verifying license key:', error);
    throw new Error(error instanceof Error ? error.message : 'Invalid license key');
  }
}

/**
 * Get all admin requests (for account holders)
 * @returns Promise that resolves with all admin requests
 */
export async function getAllAdminRequests(): Promise<any[]> {
  try {
    // Call the API function
    const requests = await getAllAdminRequestsAPI();
    console.log('Admin requests retrieved successfully');
    return requests;
  } catch (error) {
    console.error('Error retrieving admin requests:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch admin requests');
  }
}