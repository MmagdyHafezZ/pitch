import { Injectable, NotFoundException } from '@nestjs/common';
import { LtiPrismaService } from '../prisma/lti-prisma.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PlatformRepository {
  constructor(private readonly db: LtiPrismaService) {}

  async create(dto: CreatePlatformDto) {
    const hashedSecret = dto.consumerSecret
      ? await bcrypt.hash(dto.consumerSecret, 10)
      : undefined;

    return this.db.platform.create({
      data: {
        name: dto.name,
        consumerKey: dto.consumerKey,
        consumerSecret: hashedSecret,
        issuer: dto.issuer,
        clientId: dto.clientId,
        authLoginUrl: dto.authLoginUrl,
        authTokenUrl: dto.authTokenUrl,
        keysetUrl: dto.keysetUrl,
        redirectUris: dto.redirectUris ?? [],
        isActive: dto.isActive ?? true,
        ...(dto.deploymentId && {
          deployments: { create: { deploymentId: dto.deploymentId } },
        }),
      },
      include: { deployments: true },
    });
  }

  findAll() {
    return this.db.platform.findMany({ where: { isActive: true } });
  }

  async findById(id: string) {
    const platform = await this.db.platform.findUnique({ where: { id } });
    if (!platform) throw new NotFoundException(`LTI platform ${id} not found`);
    return platform;
  }

  async findByConsumerKey(consumerKey: string) {
    const platform = await this.db.platform.findUnique({
      where: { consumerKey },
    });
    if (!platform)
      throw new NotFoundException(
        `No platform for consumer key ${consumerKey}`,
      );
    return platform;
  }

  async findByIssuerAndClientId(issuer: string, clientId: string) {
    const platform = await this.db.platform.findUnique({
      where: { issuer_clientId: { issuer, clientId } },
    });
    if (!platform)
      throw new NotFoundException(
        `No platform for issuer=${issuer} clientId=${clientId}`,
      );
    return platform;
  }

  async update(id: string, data: Partial<CreatePlatformDto>) {
    await this.findById(id);
    return this.db.platform.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.db.platform.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Verify an incoming LTI 1.1 consumer secret against the stored bcrypt hash.
   */
  async verifyConsumerSecret(
    consumerKey: string,
    rawSecret: string,
  ): Promise<boolean> {
    const platform = await this.findByConsumerKey(consumerKey);
    if (!platform.consumerSecret) return false;
    return bcrypt.compare(rawSecret, platform.consumerSecret);
  }
}
