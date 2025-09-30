import {
  ExceptionFilter,
  Catch,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch(PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter
  implements ExceptionFilter<PrismaClientKnownRequestError>
{
  catch(exception: PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2025': {
        throw new NotFoundException('Record not found');
      }
      case 'P2002': {
        throw new ConflictException('Unique constraint failed');
      }
      default: {
        throw new InternalServerErrorException('Database error');
      }
    }
  }
}
