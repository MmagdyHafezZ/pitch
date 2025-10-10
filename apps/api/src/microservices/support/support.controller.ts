import { Controller, ValidationPipe, UsePipes, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SupportService } from './support.service';
import * as SupportInterface from '../../common/interfaces/support.interface';
import * as SupportClaimsInterface from '../../common/interfaces/Support-claims.interface';
import { toRpcException } from 'src/common/helpers/exceptions';

@Controller()
export class SupportController {

}