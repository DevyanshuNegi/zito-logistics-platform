import { IsIn, IsOptional } from 'class-validator';
import {
  SUPPORTED_CURRENCY_CODES,
  SUPPORTED_LANGUAGE_CODES,
} from '../../../config/app.config';

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  language?: (typeof SUPPORTED_LANGUAGE_CODES)[number];

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCY_CODES)
  currency?: (typeof SUPPORTED_CURRENCY_CODES)[number];
}
