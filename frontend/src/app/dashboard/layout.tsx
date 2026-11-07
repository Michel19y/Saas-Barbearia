"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch, getToken, clearToken, decodeToken } from "@/lib/auth";

const LINKS = [
  { href: "/dashboard/servicos", label: "Serviços" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/agendamentos", label: "Agendamentos" },
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

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex gap-4 text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname.startsWith(link.href)
                    ? "font-medium text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-950"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {papel && <span className="text-xs text-zinc-500">{papel}</span>}
            <button
              onClick={handleLogout}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
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
              className="font-medium text-zinc-950 underline"
            >
              {typeof window !== "undefined" ? window.location.origin : ""}
              /agendar/{slug}
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
