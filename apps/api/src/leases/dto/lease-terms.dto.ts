import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const LEASE_TYPES = ['MEUBLE_RP', 'NU_RP', 'SAISONNIER'] as const;
export type LeaseType = (typeof LEASE_TYPES)[number];

export const PETS_POLICIES = ['UNKNOWN', 'ALLOWED', 'FORBIDDEN'] as const;
export type PetsPolicy = (typeof PETS_POLICIES)[number];

export class IrlIndexationDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  referenceQuarter?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  referenceValue?: number;
}

export class LeaseTermsDto {
  @IsNotEmpty()
  @IsIn(LEASE_TYPES as unknown as string[])
  leaseType!: LeaseType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMonths?: number;

  @IsOptional()
  @IsBoolean()
  tacitRenewal?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  noticeTenantMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  noticeLandlordMonths?: number;

  @IsOptional()
  @IsBoolean()
  solidarityClause?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => IrlIndexationDto)
  irlIndexation?: IrlIndexationDto;

  @IsOptional()
  @IsBoolean()
  insuranceRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  sublettingAllowed?: boolean;

  @IsOptional()
  @IsIn(PETS_POLICIES as unknown as string[])
  petsPolicy?: PetsPolicy;

  @IsOptional()
  @IsString()
  specialClauses?: string;
}