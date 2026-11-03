<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Guarded;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Regras de cálculo. O registro sem sessão é a configuração global.
 */
#[Guarded(['id', 'game_session_id', 'created_at', 'updated_at'])]
class RuleSet extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'diff_easy_mod' => 'float',
            'diff_hard_div' => 'float',
            'diff_extreme_div' => 'float',
            'skill_type_vars' => 'array',
            'power_type_vars' => 'array',
            'calculation_vars' => 'array',
            'attributes' => 'array',
            'talent_categories' => 'array',
            'enable_email_password_auth' => 'boolean',
        ];
    }

    /**
     * @param  Builder<RuleSet>  $query
     */
    public function scopeGlobal(Builder $query): void
    {
        $query->whereNull('game_session_id');
    }

    /**
     * Regras da sessão ou, na ausência delas, as globais.
     */
    public static function forSession(?GameSession $session): ?self
    {
        if ($session !== null) {
            $sessionRules = $session->ruleSet;

            if ($sessionRules !== null) {
                return $sessionRules;
            }
        }

        return self::query()->global()->first();
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }
}
