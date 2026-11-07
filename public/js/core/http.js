// Requisições JSON para as rotas do Laravel, sempre com o token CSRF
// (<meta name="csrf-token">). Em erro de validação (422), devolve as
// mensagens em português que o servidor enviou. Um FormData (envio de
// arquivos) vai como multipart; qualquer outro dado vai como JSON.

const token = () => document.querySelector('meta[name="csrf-token"]')?.content ?? '';

export class HttpError extends Error {
    constructor(message, status, errors = {}) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

export async function request(url, { method = 'GET', data = undefined, params = undefined } = {}) {
    const target = new URL(url, window.location.href);
    Object.entries(params ?? {}).forEach(([name, value]) => {
        if (value !== null && value !== undefined && value !== '') target.searchParams.set(name, value);
    });

    const isForm = data instanceof FormData;
    const response = await fetch(target, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': token(),
            'X-Requested-With': 'XMLHttpRequest',
            ...(data === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
        },
        body: data === undefined ? undefined : (isForm ? data : JSON.stringify(data)),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        const firstError = Object.values(body.errors ?? {})[0]?.[0];
        const fallback = response.status === 419
            ? 'Sua sessão expirou. Recarregue a página.'
            : (response.status === 429 ? 'Muitas ações seguidas. Aguarde um instante.' : 'Não foi possível concluir a ação. Tente novamente.');
        throw new HttpError(firstError ?? (response.status >= 500 ? fallback : body.message) ?? fallback, response.status, body.errors ?? {});
    }

    return body;
}

export const getJson = (url, params) => request(url, { params });
export const postJson = (url, data) => request(url, { method: 'POST', data });
export const deleteJson = (url) => request(url, { method: 'DELETE' });
