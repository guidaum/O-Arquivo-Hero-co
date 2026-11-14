<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use App\Support\BoardVersion;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ambientação sonora e clima. Sem mapa, vale para toda a campanha.
 */
#[Fillable(['soundscape', 'weather', 'volume', 'custom_ambient_name', 'custom_ambient_path'])]
class DungeonAtmosphere extends Model
{
    use HasPublicFiles;

    /**
     * Milissegundos nas datas: dois efeitos "para a mesa" no mesmo segundo
     * continuam distintos (effect_at é DATETIME(3); nas demais colunas o
     * banco descarta a fração).
     */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    /**
     * "Mapa" da linha da campanha (sem mapa) na App\Support\BoardVersion:
     * IDs de mapa começam em 1, então 0 não colide.
     */
    public const CAMPAIGN_BOARD = 0;

    protected static function booted(): void
    {
        // Ambientação da campanha (polling do menu de ações) e combate/clima da
        // masmorra: cada gravação troca a versão no cache depois do commit.
        $bump = static function (self $atmosphere): void {
            BoardVersion::bump($atmosphere->game_session_id, $atmosphere->campaign_map_id ?? self::CAMPAIGN_BOARD);
        };

        static::saved($bump);
        static::deleted($bump);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'volume' => 'integer',
            'in_combat' => 'boolean',
            'combat_round' => 'integer',
            'active_token_id' => 'integer',
            'effect_at' => 'datetime',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function customAmbientUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->custom_ambient_path));
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
}
