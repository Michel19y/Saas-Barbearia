const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const STATUS_SEM_CONTEUDO = 204;

export async function apiFetch(path: string, options: RequestInit = {}) {
  // Envio de arquivo: o navegador define o Content-Type multipart com o boundary
  const ehFormulario = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(ehFormulario ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    // O corpo vai junto no erro: algumas respostas trazem dados úteis (ex.: 409 com a lista de afetados)
    throw Object.assign(new Error(message || `Erro ${res.status}`), { status: res.status, dados: body });
  }

  if (res.status === STATUS_SEM_CONTEUDO) return null;
  return res.json();
}
