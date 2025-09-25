import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BusinessService } from './business.service';
import { BUSINESS_SERVICE_PATTERNS } from '../../common/interfaces/message-patterns.interface';
import * as businessInterface from '../../common/interfaces/business.interface';
import * as userClaimsInterface from '../../common/interfaces/user-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';

@Controller()
export class BusinessController {
  private readonly logger = new Logger(BusinessController.name);

  constructor(private readonly businessService: BusinessService) {}

  @MessagePattern(BUSINESS_SERVICE_PATTERNS.GET_BUSINESSES)
  async getBusinesses(
    @Payload() data: userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting businesses - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.businessService.findAll();
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(BUSINESS_SERVICE_PATTERNS.GET_BUSINESS)
  async getBusiness(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting business ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.businessService.findOne(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(BUSINESS_SERVICE_PATTERNS.GET_BUSINESS_WITH_USER)
  async getBusinessWithUser(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Getting business with user ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.businessService.findOneWithUser(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(BUSINESS_SERVICE_PATTERNS.CREATE_BUSINESS)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createBusiness(
    @Payload()
    data: businessInterface.CreateBusinessDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Creating business - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { userClaims, ...createBusinessDto } = data;
      return await this.businessService.create(createBusinessDto);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(BUSINESS_SERVICE_PATTERNS.UPDATE_BUSINESS)
  @UsePipes(
    new ValidationPipe({ transform: true, skipMissingProperties: true }),
  )
  async updateBusiness(
    @Payload()
    data: { id: string } & businessInterface.UpdateBusinessDto &
      userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Updating business ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      const { id, userClaims, ...updateData } = data;
      return await this.businessService.update(id, updateData);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @MessagePattern(BUSINESS_SERVICE_PATTERNS.DELETE_BUSINESS)
  async deleteBusiness(
    @Payload() data: { id: string } & userClaimsInterface.MessageWithUserClaims,
  ) {
    try {
      this.logger.log(
        `Deleting business ${data.id} - Requested by: ${data.userClaims.email} (${data.userClaims.id})`,
      );
      return await this.businessService.remove(data.id);
    } catch (error) {
      throw toRpcException(error);
    }
  }
}
