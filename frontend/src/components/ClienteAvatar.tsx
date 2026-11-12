type ClienteAvatarProps = {
  nome: string;
};

const CORES = [
  "bg-zinc-100 text-zinc-800",
  "bg-stone-100 text-stone-800",
  "bg-neutral-100 text-neutral-800",
  "bg-slate-100 text-slate-800",
  "bg-gray-100 text-gray-800",
];

export default function ClienteAvatar({ nome }: ClienteAvatarProps) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const iniciais =
    partes
      .slice(0, 2)
      .map((parte) => Array.from(parte)[0]?.toLocaleUpperCase("pt-BR") ?? "")
      .join("") || "?";
  const indice = Array.from(nome).reduce(
    (total, caractere) => total + caractere.codePointAt(0)!,
    0,
  ) % CORES.length;

  return (
    <span
      aria-hidden="true"
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${CORES[indice]}`}
    >
      {iniciais}
    </span>
  );
}
