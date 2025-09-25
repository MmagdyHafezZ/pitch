import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateBusinessDto, UpdateBusinessDto, Business } from '../../common/interfaces/business.interface';
import { BusinessPrismaService } from './business-prisma.service';
import { USER_SERVICE_PATTERNS } from '../../common/interfaces/message-patterns.interface';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: BusinessPrismaService,
    @Inject('USER_SERVICE') private userService: ClientProxy,
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

  async findOneWithUser(id: string): Promise<Business & { user?: any }> {
    const business = await this.findOne(id);
    
    try {
      const user = await firstValueFrom(
        this.userService.send(USER_SERVICE_PATTERNS.GET_USER, { id: business.userId })
      );
      return { ...business, user };
    } catch (error) {
      // Return business without user data if user service fails
      return business;
    }
  }

  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    // Validate that user exists before creating business
    try {
      await firstValueFrom(
        this.userService.send(USER_SERVICE_PATTERNS.GET_USER, { id: createBusinessDto.userId })
      );
    } catch (error) {
      throw new NotFoundException(`User with ID ${createBusinessDto.userId} not found`);
    }

    return this.prisma.business.create({
      data: createBusinessDto,
    });
  }

  async update(id: string, updateBusinessDto: UpdateBusinessDto): Promise<Business> {
    try {
      return await this.prisma.business.update({
        where: { id },
        data: updateBusinessDto,
      });
    } catch (error) {
      if (error.code === 'P2025') {
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
      if (error.code === 'P2025') {
        throw new NotFoundException(`Business with ID ${id} not found`);
      }
      throw error;
    }
  }
}