"use client";

import { Search, X } from "lucide-react";

type BuscaClientesProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  label?: string;
};

export function CampoBusca({
  value,
  onChange,
  id = "buscar-clientes",
  placeholder = "Buscar por nome, telefone ou e-mail",
  label = "Buscar clientes",
}: BuscaClientesProps) {
  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        size={20}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-600"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pr-12 pl-10 text-base leading-6 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          <X aria-hidden="true" size={20} />
        </button>
      )}
    </div>
  );
}

export default function BuscaClientes(props: BuscaClientesProps) {
  return <CampoBusca {...props} />;
}
