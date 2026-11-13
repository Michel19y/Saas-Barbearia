"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { authFetch, getToken, clearToken, decodeToken } from "@/lib/auth";

const LINKS = [
  { href: "/dashboard/servicos", label: "Serviços" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/agendamentos", label: "Agendamentos" },
  { href: "/dashboard/equipe", label: "Equipe" },
  { href: "/dashboard/financeiro", label: "Financeiro" },
  { href: "/dashboard/importar", label: "Importar" },
  { href: "/dashboard/configuracoes", label: "Configurações" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [papel, setPapel] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [origem, setOrigem] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setOrigem(window.location.origin);
    const dados = decodeToken(token);
    setPapel(dados?.papel ?? null);
    setNome(dados?.nome ?? null);
    setPronto(true);
  }, [router, pathname]);

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!pronto) return;
    authFetch("/barbearia/minha")
      .then((data) => setSlug(data.slug))
      .catch(() => setSlug(null));
  }, [pronto]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  if (!pronto) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuAberto((atual) => !atual)}
            aria-expanded={menuAberto}
            aria-controls="menu-dashboard-mobile"
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 md:hidden"
          >
            {menuAberto ? (
              <X aria-hidden="true" size={22} />
            ) : (
              <Menu aria-hidden="true" size={22} />
            )}
          </button>

          <nav className="-mx-1 hidden max-w-full flex-nowrap gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname.startsWith(link.href)
                    ? "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 font-semibold text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                    : "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-zinc-700 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {(nome || papel) && (
              <Link
                href="/dashboard/perfil"
                className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
              >
                {nome ? <span className="font-semibold">{nome}</span> : null}
                {nome && papel ? " · " : null}
                {papel}
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Sair
            </button>
          </div>
        </div>

        {menuAberto && (
          <nav
            id="menu-dashboard-mobile"
            className="space-y-1 border-t border-zinc-200 px-4 py-3 md:hidden"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname.startsWith(link.href)
                    ? "block min-h-11 rounded-md px-3 py-2 text-base font-semibold leading-6 text-zinc-950 bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                    : "block min-h-11 rounded-md px-3 py-2 text-base leading-6 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {slug && (
        <div className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-2 text-xs text-zinc-500">
            Link de agendamento para seus clientes:{" "}
            <Link
              href={`/agendar/${slug}`}
              target="_blank"
              className="font-semibold text-zinc-950 underline"
            >
              {origem}/agendar/{slug}
            </Link>
          </div>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
