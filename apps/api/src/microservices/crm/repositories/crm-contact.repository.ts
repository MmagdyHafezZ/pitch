import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { CrmContact, CrmContactDocument } from '../schemas/crm-contact.schema';

@Injectable()
export class CrmContactRepository {
    constructor(
        @InjectModel(CrmContact.name)
        private readonly crmContactModel: Model<CrmContactDocument>,
    ) {}

    async create(contact: Partial<CrmContact>): Promise<CrmContact> {
        const createdContact = new this.crmContactModel(contact);
        return createdContact.save();
    }

    async findAll(filter: FilterQuery<CrmContactDocument> = {}): Promise<CrmContact[]> {
        return this.crmContactModel.find(filter).exec();
    }

    async findById(id: string): Promise<CrmContact | null> {
        return this.crmContactModel.findById(id).exec();
    }

    async update(id: string, update: Partial<CrmContact>): Promise<CrmContact | null> {
        return this.crmContactModel.findByIdAndUpdate(id, update, { new: true }).exec();
    }

    async delete(id: string): Promise<CrmContact | null> {
        return this.crmContactModel.findByIdAndDelete(id).exec();
    }
}