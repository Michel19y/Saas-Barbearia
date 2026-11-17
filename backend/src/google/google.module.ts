import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { GoogleAuthController } from './google-auth.controller.js';
import {
  GOOGLE_STATE_AUDIENCE,
  GOOGLE_STATE_EXPIRA_SEGUNDOS,
  GoogleService,
} from './google.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // O `state` do OAuth usa uma chave derivada, diferente da do login: assim ele nunca
      // é aceito como token de sessão pelo JwtStrategy (e vice-versa).
      useFactory: (config: ConfigService) => ({
        secret: `${config.getOrThrow<string>('JWT_SECRET')}:${GOOGLE_STATE_AUDIENCE}`,
        signOptions: { audience: GOOGLE_STATE_AUDIENCE, expiresIn: GOOGLE_STATE_EXPIRA_SEGUNDOS },
        verifyOptions: { audience: GOOGLE_STATE_AUDIENCE },
      }),
    }),
  ],
  controllers: [GoogleAuthController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
