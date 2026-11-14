<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sugestão de traço, perícia ou poder (para a base, revisada pelo
 * administrador) ou de item do inventário (para a loja da campanha,
 * revisada pelo mestre: game_session_id e character_item_id).
 * Status, campanha e item de origem ficam fora do $fillable.
 */
#[Fillable(['type', 'data'])]
#[Hidden(['firestore_id'])]
class Suggestion extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => SuggestionType::class,
            'status' => SuggestionStatus::class,
            'data' => 'array',
        ];
    }

    /**
     * Campo do formulário de catálogo => chaves possíveis nos dados da
     * sugestão (o sistema antigo gravava em camelCase).
     *
     * @var array<string, list<string>>
     */
    private const DATA_KEYS = [
        'name' => ['name'],
        'type' => ['type'],
        'description' => ['description'],
        'effect' => ['effect'],
        'damage' => ['damage'],
        'cost' => ['cost'],
        'modifier' => ['modifier'],
        'target' => ['target', 'modifierType', 'modifier_attribute'],
        'atp_cost' => ['atp_cost', 'atpCost'],
        'purchase_cost' => ['purchase_cost', 'purchaseCost'],
        'difficulty_formula' => ['difficulty_formula', 'difficultyFormula'],
    ];

    /**
     * Dados da sugestão com os nomes dos campos do formulário de catálogo.
     *
     * @return array<string, mixed>
     */
    public function formData(): array
    {
        $data = is_array($this->data) ? $this->data : [];
        $form = [];

        foreach (self::DATA_KEYS as $field => $keys) {
            foreach ($keys as $key) {
                if (array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '') {
                    $form[$field] = $data[$key];
                    break;
                }
            }
        }

        return $form;
    }

    public function name(): string
    {
        return (string) ($this->formData()['name'] ?? 'Sem nome');
    }

    /**
     * Dados de uma sugestão de item a partir do item do inventário, com os
     * nomes dos campos do formulário do catálogo de itens.
     *
     * @return array<string, mixed>
     */
    public static function itemData(CharacterItem $item): array
    {
        return [
            'name' => $item->name,
            'category' => $item->categoryKey(),
            'rarity' => $item->rarityKey(),
            'weight' => (float) $item->weight,
            'value' => (int) $item->value,
            'damage' => $item->damage,
            'defense' => (int) $item->defense,
            'description' => $item->description,
            'stats' => array_filter((array) $item->stats, static fn (mixed $bonus): bool => is_numeric($bonus) && (int) $bonus !== 0),
        ];
    }

    /**
     * Sugestões revisadas pelo administrador (as de item ficam com o mestre da campanha).
     *
     * @param  Builder<self>  $query
     */
    public function scopeForAdmin(Builder $query): void
    {
        $query->whereNull('game_session_id');
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
     * @return BelongsTo<CharacterItem, $this>
     */
    public function characterItem(): BelongsTo
    {
        return $this->belongsTo(CharacterItem::class);
    }
}
