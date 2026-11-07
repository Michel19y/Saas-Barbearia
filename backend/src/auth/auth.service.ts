import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { slugify } from '../common/slugify.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const slugBase = slugify(dto.nomeBarbearia);
    let slug = slugBase;
    let tentativa = 1;
    while (await this.prisma.barbearia.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${++tentativa}`;
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const barbearia = await this.prisma.barbearia.create({
      data: {
        nome: dto.nomeBarbearia,
        slug,
        usuarios: {
          create: {
            nome: dto.nomeDono,
            email: dto.email,
            senhaHash,
            papel: 'DONO',
          },
        },
      },
      include: { usuarios: true },
    });

    const dono = barbearia.usuarios[0];
    return this.emitirToken(dono.id, barbearia.id, dono.papel);
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email, ativo: true },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaOk = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaOk) throw new UnauthorizedException('Credenciais inválidas');

    return this.emitirToken(usuario.id, usuario.barbeariaId, usuario.papel);
  }

  private emitirToken(usuarioId: string, barbeariaId: string, papel: string) {
    const payload = { sub: usuarioId, barbeariaId, papel };
    return { accessToken: this.jwtService.sign(payload) };
  }
}
