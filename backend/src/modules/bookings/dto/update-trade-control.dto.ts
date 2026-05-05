import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  FreightTradeMode,
  RailCorridorCode,
  TradeDocumentStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTradeControlDto {
  @ApiPropertyOptional({ enum: FreightTradeMode })
  @IsOptional()
  @IsEnum(FreightTradeMode)
  tradeMode?: FreightTradeMode;

  @ApiPropertyOptional({ enum: RailCorridorCode })
  @IsOptional()
  @IsEnum(RailCorridorCode)
  railCorridorCode?: RailCorridorCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  originNode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destinationNode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  containerReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  billOfLadingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idfNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pacReady?: boolean;

  @ApiPropertyOptional({ enum: TradeDocumentStatus })
  @IsOptional()
  @IsEnum(TradeDocumentStatus)
  customsStatus?: TradeDocumentStatus;

  @ApiPropertyOptional({ enum: TradeDocumentStatus })
  @IsOptional()
  @IsEnum(TradeDocumentStatus)
  icmsStatus?: TradeDocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialInstructions?: string;
}
