import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { slugify } from '../common/slugify.js';
import {
  MENSAGEM_EMAIL_EM_USO,
  normalizarEmail,
  tratarEmailDuplicado,
} from '../common/email.js';
import { BCRYPT_CUSTO } from '../common/senha.js';
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
    const email = normalizarEmail(dto.email);
    const emailEmUso = await this.prisma.usuario.findUnique({ where: { email } });
    if (emailEmUso) throw new ConflictException(MENSAGEM_EMAIL_EM_USO);

    const slug = await this.proximoSlugLivre(slugify(dto.nomeBarbearia));
    const senhaHash = await bcrypt.hash(dto.senha, BCRYPT_CUSTO);

    try {
      const barbearia = await this.prisma.barbearia.create({
        data: {
          nome: dto.nomeBarbearia,
          slug,
          usuarios: {
            create: {
              nome: dto.nomeDono,
              email,
              senhaHash,
              papel: 'DONO',
            },
          },
        },
        include: { usuarios: true },
      });
      const dono = barbearia.usuarios[0];
      return this.emitirToken(dono.id, barbearia.id, dono.papel, dono.nome);
    } catch (erro) {
      return tratarEmailDuplicado(erro);
    }
  }

  /** `slugBase` se estiver livre; senão `slugBase-N` com o menor N >= 2 ainda não usado. */
  private async proximoSlugLivre(slugBase: string): Promise<string> {
    const existentes = await this.prisma.barbearia.findMany({
      where: { slug: { startsWith: slugBase } },
      select: { slug: true },
    });
    const usados = new Set(existentes.map((b) => b.slug));
    const candidatos = Array.from({ length: usados.size + 1 }, (_, i) =>
      i === 0 ? slugBase : `${slugBase}-${i + 1}`,
    );
    return candidatos.find((s) => !usados.has(s)) ?? slugBase;
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: normalizarEmail(dto.email) },
    });
    if (!usuario || !usuario.ativo) throw new UnauthorizedException('Credenciais inválidas');

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
      data.senhaHash = await bcrypt.hash(dto.novaSenha, BCRYPT_CUSTO);
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
