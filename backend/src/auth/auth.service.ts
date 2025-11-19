import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validate admin credentials (for future implementation)
   */
  async validateAdmin(email: string, password: string) {
    // TODO: Implement password authentication for admins
    // For now, this is a placeholder
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role === 'INTERN') {
      return null;
    }

    // Implement bcrypt comparison when passwords are added
    return user;
  }

  /**
   * Generate JWT token for admin users
   */
  async generateAdminToken(userId: string) {
    const payload = { sub: userId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  /**
   * Validate user by access token (for personal pages)
   */
  async validateAccessToken(code: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        role: true,
        accessToken: true,
        tokenExpiresAt: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    if (user.accessToken !== token) {
      return null;
    }

    if (user.tokenExpiresAt && new Date() > user.tokenExpiresAt) {
      return null;
    }

    return user;
  }

  /**
   * Generate new access token for user
   */
  async generateAccessToken(userId: string, expiryDays: number = 30) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: token,
        tokenExpiresAt: expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Reset user access token
   */
  async resetAccessToken(userId: string) {
    return this.generateAccessToken(userId);
  }
}
