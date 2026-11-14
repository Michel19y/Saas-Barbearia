/**
 * Mesmo formato que o backend aceita para o link de agendamento:
 * "Barbearia do Zé!" vira "barbearia-do-ze".
 */
export function slugify(texto: string): string {
  return (
    texto
      .normalize("NFD")
      // Remove acentos já separados pelo NFD: "é" vira "e" + acento, e o acento sai.
      // https://regex101.com/?flavor=javascript&flags=g&regex=%5B%5Cu0300-%5Cu036f%5D
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      // Troca qualquer sequência que não seja letra/número por um hífen: "do Zé!" vira "do-ze-".
      // https://regex101.com/?flavor=javascript&flags=g&regex=%5B%5Ea-z0-9%5D%2B&testString=do%20ze!
      .replace(/[^a-z0-9]+/g, "-")
      // Tira hífens das pontas: "-do-ze-" vira "do-ze"; não mexe nos do meio.
      // https://regex101.com/?flavor=javascript&flags=g&regex=%5E-%2B%7C-%2B%24&testString=-do-ze-
      .replace(/^-+|-+$/g, "")
  );
}
