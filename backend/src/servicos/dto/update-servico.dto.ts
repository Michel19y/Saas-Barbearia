import { PartialType } from '@nestjs/swagger';
import { CreateServicoDto } from './create-servico.dto.js';

export class UpdateServicoDto extends PartialType(CreateServicoDto) {}
