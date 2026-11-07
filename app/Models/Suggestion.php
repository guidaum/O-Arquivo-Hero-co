<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sugestão de traço, perícia ou poder feita por um jogador.
 * O status é alterado apenas pela moderação, fora do $fillable.
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
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
