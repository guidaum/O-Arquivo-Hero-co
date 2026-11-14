<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pulso do tempo real: uma "senha de versão" por canal (tabuleiro de um mapa,
 * chat de uma campanha, notificações de um usuário), guardada num store de
 * cache que não usa o banco (config arquivo.realtime.store).
 *
 * Toda gravação troca a senha do canal depois do commit. O navegador consulta
 * a rota /pulso (PulseController: sem sessão, cookies nem banco) e só chama o
 * endpoint completo do canal, que usa o banco, quando a senha mudou. Assim o
 * polling "nada mudou" não abre conexão com o banco (a hospedagem limita as
 * conexões por hora).
 *
 * O navegador recebe cada canal assinado (sign()): só quem recebeu o canal de
 * um endpoint autorizado consegue consultá-lo, e a senha não revela dados.
 */
final class Pulse
{
    public static function store(): Repository
    {
        return Cache::store((string) config('arquivo.realtime.store', 'file'));
    }

    public static function token(string $channel): string
    {
        return (string) self::store()->rememberForever(self::cacheKey($channel), static fn (): string => Str::random(16));
    }

    /**
     * Troca a senha do canal depois do commit (antes dele, quem consultasse
     * poderia buscar os dados antigos com a senha nova e perder a mudança).
     */
    public static function bump(string $channel): void
    {
        $key = self::cacheKey($channel);

        DB::afterCommit(static fn () => self::store()->forever($key, Str::random(16)));
    }

    /**
     * Dados do canal para o navegador (realtime.js): o canal assinado e a
     * senha atual. Leia antes de carregar os dados da resposta.
     *
     * @return array{channel: string, token: string}
     */
    public static function for(string $channel): array
    {
        return ['channel' => self::sign($channel), 'token' => self::token($channel)];
    }

    public static function sign(string $channel): string
    {
        return $channel.'.'.self::signature($channel);
    }

    /**
     * Canal de um valor assinado, ou null se a assinatura não confere.
     */
    public static function verify(string $signed): ?string
    {
        $position = strrpos($signed, '.');

        if ($position === false) {
            return null;
        }

        $channel = substr($signed, 0, $position);

        return hash_equals(self::signature($channel), substr($signed, $position + 1)) ? $channel : null;
    }

    public static function board(int $sessionId, int $mapId): string
    {
        return 'board:'.$sessionId.':'.$mapId;
    }

    public static function chat(int $sessionId): string
    {
        return 'chat:'.$sessionId;
    }

    public static function notifications(int $userId): string
    {
        return 'notifications:'.$userId;
    }

    private static function signature(string $channel): string
    {
        return substr(hash_hmac('sha256', 'pulse|'.$channel, (string) config('app.key')), 0, 24);
    }

    private static function cacheKey(string $channel): string
    {
        return 'pulse:'.$channel;
    }
}
