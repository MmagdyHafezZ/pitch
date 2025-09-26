import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CreateBusinessDto,
  UpdateBusinessDto,
  Business,
} from '../../common/interfaces/business.interface';
import { BusinessPrismaService } from './business-prisma.service';
import { USER_SERVICE_PATTERNS } from '../../common/interfaces/message-patterns.interface';
import { firstValueFrom } from 'rxjs';
import type { PrismaError } from '../../common/interfaces/error.interface';

interface UserServiceResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: BusinessPrismaService,
    @Inject('USER_SERVICE') private readonly userService: ClientProxy,
  ) {}

  async findAll(): Promise<Business[]> {
    return this.prisma.business.findMany();
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({
      where: { id },
    });
    if (!business) {
      throw new NotFoundException(`Business with ID ${id} not found`);
    }
    return business;
  }

  async findOneWithUser(
    id: string,
  ): Promise<Business & { user?: UserServiceResponse }> {
    const business = await this.findOne(id);

    try {
      const userResponse = await firstValueFrom(
        this.userService.send<UserServiceResponse>(
          USER_SERVICE_PATTERNS.GET_USER,
          {
            id: business.userId,
          },
        ),
      );
      return { ...business, user: userResponse };
    } catch {
      return business;
    }
  }

  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    try {
      await firstValueFrom(
        this.userService.send(USER_SERVICE_PATTERNS.GET_USER, {
          id: createBusinessDto.userId,
        }),
      );

      return await this.prisma.business.create({
        data: createBusinessDto,
      });
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2002') {
        throw new NotFoundException(
          `User with ID ${createBusinessDto.userId} not found`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
    try {
      return await this.prisma.business.update({
        where: { id },
        data: updateBusinessDto,
      });
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Business with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.prisma.business.delete({
        where: { id },
      });
      return { message: `Business with ID ${id} has been deleted` };
    } catch (error) {
      const err = error as PrismaError;
      if (err.code === 'P2025') {
        throw new NotFoundException(`Business with ID ${id} not found`);
      }
      throw error;
    }
  }
}
