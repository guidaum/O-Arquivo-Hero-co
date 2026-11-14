<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\BoardVersion;
use App\Support\Pulse;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * Sinalização temporária sobre um mapa (mundo ou masmorra).
 *
 * Os estados do mapa do mundo e da masmorra mandam os sinais dos últimos
 * SECONDS a cada consulta. Para não consultar a tabela a cada poucos
 * segundos por participante, cada sinal grava no cache o horário do último
 * sinal do mapa; sem sinal recente, recentFor() responde sem consultar.
 */
#[Fillable(['color', 'x', 'y'])]
class MapPing extends Model
{
    /** Quanto tempo um sinal aparece na tela. */
    public const SECONDS = 6;

    protected static function booted(): void
    {
        static::created(static function (self $ping): void {
            $key = self::cacheKey((int) $ping->game_session_id, (int) $ping->campaign_map_id);
            DB::afterCommit(static fn () => Pulse::store()->put($key, now()->getTimestamp(), self::SECONDS * 2));
            // Quem só acompanha o pulso (realtime.js) busca o estado e recebe o sinal.
            BoardVersion::bump($ping->game_session_id, $ping->campaign_map_id);
        });
    }

    /**
     * Sinais recentes de um mapa numa campanha, prontos para o navegador.
     *
     * @return list<array{id: int, x: float, y: float, color: string, user_name: string, mine: bool}>
     */
    public static function recentFor(int $sessionId, int $mapId, User $viewer): array
    {
        $last = Pulse::store()->get(self::cacheKey($sessionId, $mapId));

        if (! is_int($last) || $last < now()->getTimestamp() - self::SECONDS) {
            return [];
        }

        return self::query()
            ->with('user:id,name')
            ->where('game_session_id', $sessionId)
            ->where('campaign_map_id', $mapId)
            ->where('created_at', '>=', now()->subSeconds(self::SECONDS))
            ->orderBy('id')
            ->get()
            ->map(static fn (self $ping): array => [
                'id' => $ping->id,
                'x' => $ping->x,
                'y' => $ping->y,
                'color' => (string) $ping->color,
                'user_name' => $ping->user?->name ?? 'Aventureiro',
                'mine' => $ping->user_id === $viewer->id,
            ])
            ->values()
            ->all();
    }

    private static function cacheKey(int $sessionId, int $mapId): string
    {
        return 'map-pings:'.$sessionId.':'.$mapId;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'float',
            'y' => 'float',
        ];
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<CampaignMap, $this>
     */
    public function campaignMap(): BelongsTo
    {
        return $this->belongsTo(CampaignMap::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
