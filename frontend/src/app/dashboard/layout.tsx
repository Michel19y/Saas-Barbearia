"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch, getToken, clearToken, decodeToken } from "@/lib/auth";

const LINKS = [
  { href: "/dashboard/servicos", label: "Serviços" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/agendamentos", label: "Agendamentos" },
  { href: "/dashboard/equipe", label: "Equipe" },
  { href: "/dashboard/financeiro", label: "Financeiro" },
  { href: "/dashboard/importar", label: "Importar" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [papel, setPapel] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [origem, setOrigem] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setOrigem(window.location.origin);
    setPapel(decodeToken(token)?.papel ?? null);
    setPronto(true);
    authFetch("/barbearia/minha")
      .then((data) => setSlug(data.slug))
      .catch(() => setSlug(null));
  }, [router]);

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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <nav className="-mx-1 flex max-w-full flex-nowrap gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            {papel && <span className="text-xs text-zinc-500">{papel}</span>}
            <button
              onClick={handleLogout}
              className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              Sair
            </button>
          </div>
        </div>
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
