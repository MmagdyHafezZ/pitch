import { Injectable } from '@nestjs/common';
import { PlatformRepository } from './platform.repository';
import { CreatePlatformDto } from './dto/create-platform.dto';

@Injectable()
export class PlatformService {
  constructor(private readonly repo: PlatformRepository) {}

  create(dto: CreatePlatformDto) {
    return this.repo.create(dto);
  }

  findAll() {
    return this.repo.findAll();
  }

  findOne(id: string) {
    return this.repo.findById(id);
  }

  findByConsumerKey(key: string) {
    return this.repo.findByConsumerKey(key);
  }

  findByIssuerAndClientId(issuer: string, clientId: string) {
    return this.repo.findByIssuerAndClientId(issuer, clientId);
  }

  update(id: string, dto: Partial<CreatePlatformDto>) {
    return this.repo.update(id, dto);
  }

  remove(id: string) {
    return this.repo.remove(id);
  }
}
