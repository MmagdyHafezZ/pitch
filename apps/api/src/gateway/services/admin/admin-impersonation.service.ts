import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminImpersonationService {
  constructor(private readonly jwtService: JwtService) {}

  impersonate(
    targetUser: { id: string; email: string; name?: string },
    adminEmail: string,
  ): { token: string; expiresAt: string } {
    const payload = {
      sub: targetUser.id,
      email: targetUser.email,
      name: targetUser.name ?? '',
      impersonatedBy: adminEmail,
    };

    const token = this.jwtService.sign(payload, { expiresIn: '15m' });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return { token, expiresAt };
  }
}
