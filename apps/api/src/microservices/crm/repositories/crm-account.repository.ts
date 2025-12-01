import { EntityRepository, Repository } from 'typeorm';
import { CrmAccount } from '../entities/crm-account.entity';

@EntityRepository(CrmAccount)
export class CrmAccountRepository extends Repository<CrmAccount> {
    // Add custom repository methods here if needed
}