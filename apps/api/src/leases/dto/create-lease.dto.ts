import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export type LeaseChargesMode = 'FORFAIT' | 'PROVISION';
export type LeaseKind = 'MEUBLE_RP' | 'NU_RP' | 'SAISONNIER';

export class CreateLeaseDto {
  @IsString()
  unitId!: string;

  // Locataire principal (obligatoire)
  @IsString()
  tenantId!: string;

  // Co-locataires optionnels à la création
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coTenantIds?: string[];

  @IsISO8601()
  startDate!: string;

  @IsOptional()
  @IsISO8601()
  endDateTheoretical?: string;

  @IsInt()
  @Min(0)
  rentCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  chargesCents?: number;

  @IsOptional()
  @IsIn(['FORFAIT', 'PROVISION'])
  chargesMode?: LeaseChargesMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  depositCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDay?: number;

  @IsOptional()
  @IsIn(['MEUBLE_RP', 'NU_RP', 'SAISONNIER'])
  kind?: LeaseKind;

  // Garant “classique” (optionnel)
  @IsOptional()
  @IsString()
  guarantorFullName?: string;

  @IsOptional()
  @IsEmail()
  guarantorEmail?: string;

  @IsOptional()
  @IsString()
  guarantorPhone?: string;

  @IsOptional()
  @IsString()
  guarantorAddress?: string;

  // Designation / IRL / Keys (optionnels)
  @IsOptional()
  leaseDesignation?: any;

  @IsOptional()
  @IsInt()
  keysCount?: number | null;

  @IsOptional()
  @IsString()
  irlReferenceQuarter?: string | null;

  @IsOptional()
  irlReferenceValue?: number | null;
}
