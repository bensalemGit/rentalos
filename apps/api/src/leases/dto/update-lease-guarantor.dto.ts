import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateLeaseGuarantorDto {
  @IsOptional() @IsString() guarantorFullName?: string | null;
  @IsOptional() @IsEmail() guarantorEmail?: string | null;
  @IsOptional() @IsString() guarantorPhone?: string | null;
  @IsOptional() @IsString() guarantorAddress?: string | null;
}