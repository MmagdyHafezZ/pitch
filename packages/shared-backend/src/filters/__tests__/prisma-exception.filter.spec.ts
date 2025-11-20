import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { PrismaClientExceptionFilter } from '../prisma-exception.filter'

describe('PrismaClientExceptionFilter', () => {
  const createException = (code: string) => ({ code }) as unknown as PrismaClientKnownRequestError

  const filter = new PrismaClientExceptionFilter()

  it('translates P2025 errors to NotFoundException', () => {
    expect(() => filter.catch(createException('P2025'))).toThrow(NotFoundException)
  })

  it('translates P2002 errors to ConflictException', () => {
    expect(() => filter.catch(createException('P2002'))).toThrow(ConflictException)
  })

  it('translates unhandled codes to InternalServerErrorException', () => {
    expect(() => filter.catch(createException('UNKNOWN'))).toThrow(InternalServerErrorException)
  })
})
