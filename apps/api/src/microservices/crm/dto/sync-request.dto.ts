import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncContactDto {
    @IsString()
    id: string;

    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;
}

export class SyncRequestDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SyncContactDto)
    contacts: SyncContactDto[];

    @IsString()
    @IsOptional()
    source?: string;
}