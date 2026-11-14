import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const registro = {
  nomeBarbearia: 'Barbearia Excellence',
  nomeDono: 'Henrique',
  email: 'henrique@exemplo.test',
  senha: 'senha-de-teste',
};

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    usuario: { findUnique: vi.fn() },
    barbearia: { findMany: vi.fn(), create: vi.fn() },
    slugAntigo: { findMany: vi.fn() },
  };
  const jwt = { sign: vi.fn(() => 'token') };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.barbearia.findMany.mockResolvedValue([]);
    prisma.slugAntigo.findMany.mockResolvedValue([]);
    prisma.barbearia.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'barbearia-1',
        usuarios: [{ id: 'usuario-1', papel: 'DONO', nome: data.usuarios.create.nome }],
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('register', () => {
    it('salva o e-mail em minúsculas e sem espaços', async () => {
      await service.register({ ...registro, email: '  Henrique@Exemplo.TEST ' });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'henrique@exemplo.test' },
      });
      const { data } = prisma.barbearia.create.mock.calls[0][0];
      expect(data.usuarios.create.email).toBe('henrique@exemplo.test');
    });

    it('recusa e-mail já usado por qualquer barbearia', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 'outro', barbeariaId: 'outra' });

      await expect(service.register(registro)).rejects.toThrow(ConflictException);
      expect(prisma.barbearia.create).not.toHaveBeenCalled();
    });

    it('converte a violação de índice único (cadastro simultâneo) em 409', async () => {
      prisma.barbearia.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      await expect(service.register(registro)).rejects.toThrow(ConflictException);
    });

    it('repassa outros erros do banco sem mascarar', async () => {
      const falha = new Error('banco fora do ar');
      prisma.barbearia.create.mockRejectedValue(falha);

      await expect(service.register(registro)).rejects.toBe(falha);
    });

    it('gera o slug a partir do nome e usa o próximo número livre', async () => {
      prisma.barbearia.findMany.mockResolvedValue([
        { slug: 'barbearia-excellence' },
        { slug: 'barbearia-excellence-2' },
      ]);

      await service.register(registro);

      expect(prisma.barbearia.create.mock.calls[0][0].data.slug).toBe(
        'barbearia-excellence-3',
      );
    });

    it('não reaproveita link antigo de outra barbearia', async () => {
      prisma.slugAntigo.findMany.mockResolvedValue([{ slug: 'barbearia-excellence' }]);

      await service.register(registro);

      expect(prisma.barbearia.create.mock.calls[0][0].data.slug).toBe(
        'barbearia-excellence-2',
      );
    });

    it('converte link duplicado em cadastro simultâneo em 409', async () => {
      prisma.barbearia.create.mockRejectedValue({ code: 'P2002', meta: { target: ['slug'] } });

      await expect(service.register(registro)).rejects.toThrow(
        new ConflictException('Esse link já está em uso, escolha outro'),
      );
    });

    it('usa o slug puro quando está livre', async () => {
      await service.register(registro);

      expect(prisma.barbearia.create.mock.calls[0][0].data.slug).toBe(
        'barbearia-excellence',
      );
    });
  });

  describe('login', () => {
    const CUSTO_BCRYPT_RAPIDO_PARA_TESTE = 4;
    const senhaHash = bcrypt.hashSync('senha-de-teste', CUSTO_BCRYPT_RAPIDO_PARA_TESTE);

    it('encontra o usuário pelo e-mail normalizado e emite o token da barbearia dele', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'usuario-1',
        barbeariaId: 'barbearia-1',
        papel: 'DONO',
        nome: 'Henrique',
        ativo: true,
        senhaHash,
      });

      const resultado = await service.login({
        email: 'HENRIQUE@exemplo.test',
        senha: 'senha-de-teste',
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'henrique@exemplo.test' },
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'usuario-1', barbeariaId: 'barbearia-1' }),
      );
      expect(resultado).toEqual({ accessToken: 'token' });
    });

    it('recusa usuário desativado com a mesma mensagem genérica', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ativo: false, senhaHash });

      await expect(
        service.login({ email: registro.email, senha: 'senha-de-teste' }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });

    it('recusa senha errada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ativo: true, senhaHash });

      await expect(
        service.login({ email: registro.email, senha: 'outra-senha' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('DTOs', () => {
    it('normalizam o e-mail antes de validar', async () => {
      const login = plainToInstance(LoginDto, {
        email: ' Henrique@Exemplo.TEST ',
        senha: 'senha-de-teste',
      });
      const cadastro = plainToInstance(RegisterDto, {
        ...registro,
        email: 'HENRIQUE@EXEMPLO.TEST',
      });

      expect(await validate(login)).toHaveLength(0);
      expect(await validate(cadastro)).toHaveLength(0);
      expect(login.email).toBe('henrique@exemplo.test');
      expect(cadastro.email).toBe('henrique@exemplo.test');
    });
  });
});
