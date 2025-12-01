import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';

export enum CrmProvider {
    SALESFORCE = 'salesforce',
    HUBSPOT = 'hubspot',
    ZOHO = 'zoho',
    PIPEDRIVE = 'pipedrive',
}

export class ConnectCrmDto {
    @IsEnum(CrmProvider)
    provider: CrmProvider;

    @IsString()
    @IsOptional()
    apiKey?: string;

    @IsString()
    @IsOptional()
    accessToken?: string;

    @IsString()
    @IsOptional()
    refreshToken?: string;

    @IsEmail()
    @IsOptional()
    userEmail?: string;
}

export class DisconnectCrmDto {
    @IsEnum(CrmProvider)
    provider: CrmProvider;

    @IsString()
    @IsOptional()
    userEmail?: string;
}