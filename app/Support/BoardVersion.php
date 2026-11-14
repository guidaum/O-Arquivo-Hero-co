<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Versão do tabuleiro de um mapa numa campanha (tokens, AoEs, marcadores,
 * desenhos, névoa, pins, sinais, camadas, combate e clima). É a senha do
 * canal do tabuleiro no pulso (App\Support\Pulse): a mesma troca avisa o
 * polling leve (/pulso, sem banco) e o endpoint completo do estado.
 *
 * Em vez de recalcular a versão lendo todas essas tabelas a cada consulta,
 * cada escrita troca este valor (Models\Concerns\BumpsBoardVersion, ou bump()
 * direto nas exclusões em massa) e a consulta só compara.
 *
 * A troca acontece depois do commit: antes dele, uma consulta poderia ler a
 * versão nova com os dados antigos e o navegador ficaria sem a mudança.
 * Como rede de segurança (cache limpo, retrato trocado na ficha, escrita
 * futura sem bump), quem usa a versão também mistura a janela de
 * SAFETY_SECONDS: no pior caso, a mudança chega nesse intervalo (ou na
 * conferência periódica do realtime.js, para quem só acompanha o pulso).
 */
final class BoardVersion
{
    public const SAFETY_SECONDS = 30;

    public static function current(int $sessionId, int $mapId): string
    {
        return Pulse::token(Pulse::board($sessionId, $mapId));
    }

    public static function bump(int|string|null $sessionId, int|string|null $mapId): void
    {
        if ($sessionId === null || $mapId === null) {
            return;
        }

        Pulse::bump(Pulse::board((int) $sessionId, (int) $mapId));
    }

    /**
     * Valor que entra no hash de versão de quem consulta.
     */
    public static function fingerprint(int $sessionId, int $mapId): string
    {
        return self::current($sessionId, $mapId).'@'.intdiv(now()->getTimestamp(), self::SAFETY_SECONDS);
    }
}
