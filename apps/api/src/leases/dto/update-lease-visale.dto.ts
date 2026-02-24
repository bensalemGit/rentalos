import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateLeaseVisaleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() visaNumber?: string | null;
}