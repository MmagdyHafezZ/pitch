import { IsBoolean, IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateCrmSettingsDto {
    @IsOptional()
    @IsString()
    crmName?: string;

    @IsOptional()
    @IsString()
    crmUrl?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    maxUsers?: number;
}