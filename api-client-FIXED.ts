// FIXED VERSION: api-client.ts
// Key changes:
// 1. Explicit return type annotation
// 2. Response validation
// 3. Enhanced logging

import type { AdminUser, CreateUserRequest, UserRole, UserTier } from "@/types/admin";

class AdminAPIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      // Add auth headers if needed
    };
  }

  /**
   * Create a new user
   * FIXED: Explicit return type and validation
   */
  async createUser(data: CreateUserRequest): Promise<{
    user: AdminUser;
    temporaryPassword?: string;
  }> {
    console.group('📡 [API Client] createUser called');
    console.log('Request data:', {
      ...data,
      sendInvite: data.sendInvite,
      sendInviteType: typeof data.sendInvite
    });

    try {
      const url = `${this.baseUrl}/api/admin/users`;
      console.log('🌐 [API Client] POST to:', url);

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      console.log('📨 [API Client] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type')
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API Client] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        console.groupEnd();
        throw new Error(`Failed to create user: ${response.status} ${response.statusText}`);
      }

      // FIXED: Parse and validate response
      const rawResult = await response.json();
      
      console.log('📦 [API Client] Raw response body:', rawResult);
      console.log('🔍 [API Client] Response validation:', {
        isObject: typeof rawResult === 'object',
        hasUser: 'user' in rawResult,
        hasTemporaryPassword: 'temporaryPassword' in rawResult,
        temporaryPasswordValue: rawResult.temporaryPassword,
        temporaryPasswordType: typeof rawResult.temporaryPassword,
        isUndefined: rawResult.temporaryPassword === undefined,
        isNull: rawResult.temporaryPassword === null,
        isEmpty: rawResult.temporaryPassword === '',
        length: rawResult.temporaryPassword?.length || 0,
        allKeys: Object.keys(rawResult)
      });

      // FIXED: Explicit type construction with validation
      const result: {
        user: AdminUser;
        temporaryPassword?: string;
      } = {
        user: rawResult.user,
        temporaryPassword: rawResult.temporaryPassword
      };

      // FIXED: Validate the constructed result
      if (!result.user) {
        console.error('❌ [API Client] Invalid response: missing user');
        console.groupEnd();
        throw new Error('Invalid response: missing user object');
      }

      console.log('✅ [API Client] Response parsed successfully:', {
        hasUser: !!result.user,
        userEmail: result.user.email,
        hasTemporaryPassword: !!result.temporaryPassword,
        temporaryPasswordPresent: result.temporaryPassword ? 'YES' : 'NO',
        // For debugging - remove in production:
        temporaryPassword: result.temporaryPassword
      });
      console.groupEnd();

      return result;

    } catch (error) {
      console.error('❌ [API Client] Error in createUser:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<AdminUser[]> {
    const response = await fetch(`${this.baseUrl}/api/admin/users`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }

    const data = await response.json();
    return data.users || [];
  }

  // Additional methods...
}

export const adminAPI = new AdminAPIClient();
