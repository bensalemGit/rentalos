import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { LeaseTermsDto } from './lease-terms.dto';

export class UpdateLeaseTermsDto {
  @ValidateNested()
  @Type(() => LeaseTermsDto)
  leaseTerms!: LeaseTermsDto;
}