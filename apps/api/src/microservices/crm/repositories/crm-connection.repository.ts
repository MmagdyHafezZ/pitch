import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmConnection } from '../entities/crm-connection.entity';

@Injectable()
export class CrmConnectionRepository {
    constructor(
        @InjectRepository(CrmConnection)
        private readonly repository: Repository<CrmConnection>,
    ) {}

    async findAll(): Promise<CrmConnection[]> {
        return this.repository.find();
    }

    async findById(id: number): Promise<CrmConnection | null> {
        return this.repository.findOne({ where: { id } });
    }

    async create(data: Partial<CrmConnection>): Promise<CrmConnection> {
        const entity = this.repository.create(data);
        return this.repository.save(entity);
    }

    async update(id: number, data: Partial<CrmConnection>): Promise<CrmConnection | null> {
        await this.repository.update(id, data);
        return this.findById(id);
    }

    async delete(id: number): Promise<void> {
        await this.repository.delete(id);
    }
}