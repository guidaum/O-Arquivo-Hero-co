<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Versão do tabuleiro de um mapa numa campanha (tokens, AoEs, marcadores,
 * desenhos e névoa), guardada no cache.
 *
 * O estado da masmorra é consultado a cada 2,5 s por participante. Em vez de
 * recalcular a versão lendo todas essas tabelas a cada consulta, cada escrita
 * troca este valor (Models\Concerns\BumpsBoardVersion, ou bump() direto nas
 * exclusões em massa) e a consulta só compara.
 *
 * A troca acontece depois do commit: antes dele, uma consulta poderia ler a
 * versão nova com os dados antigos e o navegador ficaria sem a mudança.
 * Como rede de segurança (cache limpo, retrato trocado na ficha, escrita
 * futura sem bump), quem usa a versão também mistura a janela de
 * SAFETY_SECONDS: no pior caso, a mudança chega nesse intervalo.
 */
final class BoardVersion
{
    public const SAFETY_SECONDS = 30;

    public static function current(int $sessionId, int $mapId): string
    {
        return (string) Cache::rememberForever(self::key($sessionId, $mapId), static fn (): string => Str::random(16));
    }

    public static function bump(int|string|null $sessionId, int|string|null $mapId): void
    {
        if ($sessionId === null || $mapId === null) {
            return;
        }

        $key = self::key((int) $sessionId, (int) $mapId);

        DB::afterCommit(static fn () => Cache::forever($key, Str::random(16)));
    }

    /**
     * Valor que entra no hash de versão de quem consulta.
     */
    public static function fingerprint(int $sessionId, int $mapId): string
    {
        return self::current($sessionId, $mapId).'@'.intdiv(now()->getTimestamp(), self::SAFETY_SECONDS);
    }

    private static function key(int $sessionId, int $mapId): string
    {
        return 'board-version:'.$sessionId.':'.$mapId;
    }
}
