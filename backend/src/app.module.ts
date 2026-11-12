import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ServicosModule } from './servicos/servicos.module.js';
import { ProfissionaisModule } from './profissionais/profissionais.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { AgendamentosModule } from './agendamentos/agendamentos.module.js';
import { GoogleModule } from './google/google.module.js';
import { ImportacoesModule } from './importacoes/importacoes.module.js';
import { AtendimentosModule } from './atendimentos/atendimentos.module.js';
import { PublicoModule } from './publico/publico.module.js';
import { BarbeariaModule } from './barbearia/barbearia.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ServicosModule,
    ProfissionaisModule,
    ClientesModule,
    AgendamentosModule,
    GoogleModule,
    ImportacoesModule,
    AtendimentosModule,
    PublicoModule,
    BarbeariaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
