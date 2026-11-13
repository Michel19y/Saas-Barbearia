import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { slugify } from '../common/slugify.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

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
    return this.emitirToken(dono.id, barbearia.id, dono.papel, dono.nome);
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email, ativo: true },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaOk = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaOk) throw new UnauthorizedException('Credenciais inválidas');

    return this.emitirToken(usuario.id, usuario.barbeariaId, usuario.papel, usuario.nome);
  }

  private emitirToken(usuarioId: string, barbeariaId: string, papel: string, nome: string) {
    const payload = { sub: usuarioId, barbeariaId, papel, nome };
    return { accessToken: this.jwtService.sign(payload) };
  }

  async me(usuarioId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nome: true, email: true, papel: true },
    });
  }

  async updateMe(usuarioId: string, dto: UpdateMeDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException();

    const data: { nome?: string; senhaHash?: string } = {};
    if (dto.nome) data.nome = dto.nome.trim();

    if (dto.novaSenha) {
      if (!dto.senhaAtual) {
        throw new BadRequestException('Informe a senha atual para definir uma nova');
      }
      const senhaOk = await bcrypt.compare(dto.senhaAtual, usuario.senhaHash);
      if (!senhaOk) throw new BadRequestException('Senha atual incorreta');
      data.senhaHash = await bcrypt.hash(dto.novaSenha, 10);
    }

    const atualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data,
      select: { id: true, nome: true, email: true, papel: true, barbeariaId: true },
    });

    return {
      usuario: atualizado,
      ...this.emitirToken(
        atualizado.id,
        atualizado.barbeariaId,
        atualizado.papel,
        atualizado.nome,
      ),
    };
  }
}
