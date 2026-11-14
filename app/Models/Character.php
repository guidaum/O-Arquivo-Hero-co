<?php

declare(strict_types=1);

namespace App\Models;

use App\Game\CharacterSheet;
use App\Game\FormulaEvaluator;
use App\Game\GameRules;
use App\Models\Concerns\HasPublicFiles;
use App\Support\BoardVersion;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Campos de controle (user_id, game_session_id, can_edit_stats, is_npc)
 * ficam fora do $fillable e são definidos explicitamente pelo controller.
 */
#[Fillable([
    'name', 'class', 'image_path', 'color', 'icon',
    'level', 'xp', 'xp_max', 'attribute_points', 'skill_points', 'power_points',
    'current_pv', 'temp_pv', 'current_atp', 'protection', 'awakening', 'sanity', 'money',
    'base_stats', 'stats', 'stats_mods', 'talent_mods', 'model_sheet_3d',
])]
#[Hidden(['firestore_id'])]
class Character extends Model
{
    use HasPublicFiles;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_npc' => 'boolean',
            'is_monster' => 'boolean',
            'monster_size' => 'integer',
            'can_edit_stats' => 'boolean',
            'level' => 'integer',
            'xp' => 'integer',
            'xp_max' => 'integer',
            'money' => 'integer',
            'base_stats' => 'array',
            'stats' => 'array',
            'stats_mods' => 'array',
            'talent_mods' => 'array',
            'model_sheet_3d' => 'array',
            'gm_modifiers' => 'array',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    /**
     * Variáveis das rolagens (dano de itens, "/r" no chat, iniciativa na
     * masmorra): o valor TOTAL de cada atributo, o mesmo da ficha (base, mod,
     * traços, itens equipados e ajustes do mestre, pelas regras da campanha),
     * mais as demais variáveis das fórmulas da ficha (LUTA, SKILLS...).
     * Ex.: FOR base 5 + 2 de traços => "1D4 + 4 + FOR" rola 1D4 + 4 + 7.
     *
     * Chaves gravadas em stats fora da lista de atributos (ex.: "pv" de
     * monstros gerados) continuam disponíveis com o valor base.
     *
     * @return array<string, int|float>
     */
    public function rollStats(): array
    {
        $extra = [];

        foreach ((array) ($this->stats ?? []) as $attribute => $value) {
            $extra[FormulaEvaluator::variableName((string) $attribute)] = is_numeric($value) ? $value + 0 : 0;
        }

        $this->loadMissing(['gameSession', 'skills', 'powers', 'traits', 'items']);
        $session = $this->gameSession;
        $talents = CampaignLibrary::for($session)->entries(Talent::class)->values();
        $sheet = CharacterSheet::for($this, GameRules::forSession($session), $talents);

        return [...$extra, ...$sheet->data['formula_stats']];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsToMany<Skill, $this>
     */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class)->withPivot(['level', 'type', 'description']);
    }

    /**
     * @return BelongsToMany<Power, $this>
     */
    public function powers(): BelongsToMany
    {
        return $this->belongsToMany(Power::class)->withPivot(['level', 'type', 'description']);
    }

    /**
     * @return BelongsToMany<CharacterTrait, $this>
     */
    public function traits(): BelongsToMany
    {
        return $this->belongsToMany(CharacterTrait::class, 'character_trait', 'character_id', 'trait_id');
    }

    /**
     * @return HasMany<CharacterItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(CharacterItem::class);
    }

    /**
     * @return HasMany<CharacterNote, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(CharacterNote::class);
    }

    /**
     * Exclui o personagem com tudo o que é dele: perícias, poderes, traços,
     * itens e anotações saem pelas chaves estrangeiras; os tokens das
     * masmorras são apagados aqui (a chave deles só fica nula) e os arquivos
     * enviados (retrato e imagens dos itens) saem do disco depois.
     */
    public function deleteWithFiles(): void
    {
        $files = $this->items()->pluck('image_path')->push($this->image_path)
            ->filter(static fn (?string $path): bool => $path !== null && $path !== '' && ! str_starts_with($path, 'http'))
            ->values()
            ->all();

        DB::transaction(function (): void {
            // Exclusão em massa não dispara eventos: avisa antes cada tabuleiro afetado.
            $this->bumpBoards();
            DungeonToken::query()->where('character_id', $this->id)->delete();
            $this->delete();
        });

        if ($files !== []) {
            Storage::disk('public')->delete($files);
        }
    }

    /**
     * O retrato da ficha aparece nos tokens: trocá-lo atualiza os tabuleiros
     * onde o personagem está (App\Support\BoardVersion).
     */
    protected static function booted(): void
    {
        static::updated(static function (Character $character): void {
            if ($character->wasChanged('image_path')) {
                $character->bumpBoards();
            }
        });
    }

    private function bumpBoards(): void
    {
        DungeonToken::query()->where('character_id', $this->id)
            ->distinct()
            ->get(['game_session_id', 'campaign_map_id'])
            ->each(static fn (DungeonToken $token) => BoardVersion::bump($token->game_session_id, $token->campaign_map_id));
    }
}
