// FIXED VERSION: user-management.ts (service)
// Key changes:
// 1. Enhanced logging for password logic
// 2. Explicit type checks
// 3. Clear return value validation

import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { CreateUserRequest, AdminUser } from "../../types/admin";

class UserManagementService {
  /**
   * Create a new user with optional invitation email
   */
  async createUser(data: CreateUserRequest): Promise<{
    user: AdminUser;
    temporaryPassword?: string;
  }> {
    console.group('🔧 [UserService] createUser called');
    console.log('Input data:', {
      email: data.email,
      role: data.role,
      tier: data.tier,
      sendInvite: data.sendInvite,
      sendInviteType: typeof data.sendInvite
    });

    try {
      // Generate temporary password
      const tempPassword = crypto.randomBytes(16).toString("hex");
      console.log('🔑 [UserService] Generated temporary password:', {
        length: tempPassword.length,
        // For debugging - remove in production:
        value: tempPassword
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      console.log('🔒 [UserService] Password hashed');

      // Create user in database (pseudo-code - adjust for your ORM)
      const newUser = await this.createUserInDatabase({
        email: data.email,
        password: hashedPassword,
        role: data.role,
        tier: data.tier,
        isVerified: !data.sendInvite, // Auto-verify if not sending invite
      });
      
      console.log('✅ [UserService] User created in database:', {
        id: newUser.id,
        email: newUser.email
      });

      // CRITICAL: Password return logic
      const shouldReturnPassword = !data.sendInvite;
      const passwordToReturn = shouldReturnPassword ? tempPassword : undefined;

      // FIXED: Comprehensive logging of password logic
      console.log('🎯 [UserService] Password return logic:', {
        sendInvite: data.sendInvite,
        sendInviteType: typeof data.sendInvite,
        isExplicitFalse: data.sendInvite === false,
        isExplicitTrue: data.sendInvite === true,
        shouldReturnPassword,
        hasTempPassword: !!tempPassword,
        willReturnPassword: !!passwordToReturn,
        passwordToReturnType: typeof passwordToReturn,
        passwordToReturn: passwordToReturn || 'undefined'
      });

      // Send invitation email if requested
      if (data.sendInvite) {
        console.log('📧 [UserService] Sending invitation email...');
        await this.sendInvitationEmail(data.email, tempPassword);
        console.log('✅ [UserService] Invitation email sent');
      } else {
        console.log('🚫 [UserService] Skipping invitation email (sendInvite: false)');
      }

      // FIXED: Construct return value with explicit structure
      const result = {
        user: newUser,
        temporaryPassword: passwordToReturn
      };

      // FIXED: Validate return value before returning
      console.log('📤 [UserService] Returning result:', {
        hasUser: !!result.user,
        userEmail: result.user.email,
        hasTemporaryPassword: !!result.temporaryPassword,
        temporaryPasswordType: typeof result.temporaryPassword,
        temporaryPasswordValue: result.temporaryPassword || 'undefined',
        resultKeys: Object.keys(result),
        // Verify the property exists:
        hasTemporaryPasswordKey: 'temporaryPassword' in result
      });
      console.groupEnd();

      return result;

    } catch (error) {
      console.error('❌ [UserService] Error in createUser:', error);
      console.groupEnd();
      throw error;
    }
  }

  /**
   * Create user in database (implement with your ORM)
   */
  private async createUserInDatabase(data: {
    email: string;
    password: string;
    role: string;
    tier: string;
    isVerified: boolean;
  }): Promise<AdminUser> {
    // TODO: Implement with Prisma or your ORM
    // Example with Prisma:
    // return await prisma.user.create({ data });
    
    // Placeholder for now
    return {
      id: crypto.randomUUID(),
      email: data.email,
      role: data.role as any,
      tier: data.tier as any,
      isVerified: data.isVerified,
      createdAt: new Date(),
      updatedAt: new Date()
    } as AdminUser;
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    email: string,
    temporaryPassword: string
  ): Promise<void> {
    // TODO: Implement with SendGrid or your email service
    console.log(`Sending invitation to ${email} with password: ${temporaryPassword}`);
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<AdminUser[]> {
    // TODO: Implement
    return [];
  }
}

export const userManagementService = new UserManagementService();
