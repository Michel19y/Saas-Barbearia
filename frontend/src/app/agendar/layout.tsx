import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed } from "next/font/google";

/** Letra condensada de letreiro de barbearia, só para o nome da barbearia na página do cliente. */
const letreiro = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-letreiro",
});

export const metadata: Metadata = {
  title: "Agendar horário",
  description: "Escolha o serviço, o dia e o horário na sua barbearia.",
};

export default function AgendarLayout({ children }: { children: ReactNode }) {
  return <div className={`${letreiro.variable} flex flex-1 flex-col bg-white`}>{children}</div>;
}
