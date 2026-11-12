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
#[Guarded(['id', 'game_session_id', 'version', 'base_version', 'base_snapshot', 'created_at', 'updated_at'])]
class RuleSet extends Model
{
    /**
     * Colunas que não são regras do jogo (fora da comparação com a base).
     * A autenticação por e-mail e senha é só da configuração global.
     */
    private const NOT_RULES = ['id', 'game_session_id', 'version', 'base_version', 'base_snapshot', 'enable_email_password_auth', 'created_at', 'updated_at'];

    /** Rótulos das regras, usados nas sugestões de mudança da base. */
    public const FIELD_LABELS = [
        'max_attribute_points' => 'Pontos de atributo iniciais',
        'max_single_attribute_value' => 'Valor máximo por atributo',
        'initial_skill_points' => 'Pontos de perícia iniciais',
        'initial_power_points' => 'Pontos de poder iniciais',
        'initial_money' => 'Dinheiro inicial',
        'attr_points_per_level' => 'Atributos por nível',
        'skill_points_per_level' => 'Perícias por nível',
        'power_points_per_level' => 'Poderes por nível',
        'npc_default_min_attr' => 'NPC: atributo mínimo',
        'npc_default_max_attr' => 'NPC: atributo máximo',
        'npc_default_attr_points' => 'NPC: pontos de atributo',
        'npc_default_skill_points' => 'NPC: pontos de perícia',
        'npc_default_power_points' => 'NPC: pontos de poder',
        'diff_easy_mod' => 'Bônus do teste fácil',
        'diff_hard_div' => 'Divisor do teste difícil',
        'diff_extreme_div' => 'Divisor do teste extremo',
        'pv_formula' => 'Fórmula de PV máximo',
        'atp_formula' => 'Fórmula de ATP máximo',
        'soco_formula' => 'Fórmula de soco',
        'chute_formula' => 'Fórmula de chute',
        'defesa_formula' => 'Fórmula de defesa',
        'esquiva_formula' => 'Fórmula de esquiva',
        'en_formula' => 'Fórmula de EN',
        'dm_formula' => 'Fórmula de DM',
        'skill_cost_formula' => 'Fórmula de custo de perícia',
        'power_cost_formula' => 'Fórmula de custo de poder',
        'skill_type_vars' => 'Tipos de perícia',
        'power_type_vars' => 'Tipos de poder',
        'calculation_vars' => 'Variáveis de cálculo',
        'attributes' => 'Atributos',
        'talent_categories' => 'Categorias de talento',
        'dice_roll_sound' => 'Som da rolagem',
        'critical_sound' => 'Som do crítico',
        'fumble_sound' => 'Som da falha crítica',
        'success_sound' => 'Som do sucesso',
        'failure_sound' => 'Som da falha',
        'sound_settings' => 'Demais sons',
    ];

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
            'sound_settings' => 'array',
            'version' => 'integer',
            'base_version' => 'integer',
            'base_snapshot' => 'array',
        ];
    }

    /**
     * Regras novas de uma campanha: cópia da base, guardando como
     * referência os valores da base que a campanha herdou.
     */
    public static function copyOfGlobalFor(GameSession $session): self
    {
        $global = self::query()->global()->first();
        $copy = $global?->replicate(['game_session_id', 'version', 'base_version', 'base_snapshot']) ?? new self;
        $copy->game_session_id = $session->id;
        $copy->version = 1;
        $copy->base_version = (int) ($global?->version ?? 1);
        $copy->base_snapshot = $global?->ruleValues() ?? [];

        return $copy;
    }

    /**
     * Salva a configuração global. Se alguma regra mudou, as campanhas que
     * ainda herdavam a base ficam com as regras anteriores e recebem as
     * mudanças como sugestão (pendingBaseChanges()), em vez de mudarem sozinhas.
     */
    public function saveAsGlobal(): void
    {
        $rules = array_values(array_diff(array_keys($this->getAttributes()), self::NOT_RULES));

        if ($this->exists && $this->isDirty($rules)) {
            $previous = (new self)->setRawAttributes($this->getRawOriginal(), true);
            $withRules = self::query()->whereNotNull('game_session_id')->pluck('game_session_id');

            foreach (GameSession::query()->whereNotIn('id', $withRules)->pluck('id') as $sessionId) {
                $copy = $previous->replicate(['game_session_id', 'version', 'base_version', 'base_snapshot']);
                $copy->game_session_id = (int) $sessionId;
                $copy->version = 1;
                $copy->base_version = (int) ($previous->version ?? 1);
                $copy->base_snapshot = $previous->ruleValues();
                $copy->save();
            }

            $this->version = (int) ($previous->version ?? 1) + 1;
        }

        $this->game_session_id = null;
        $this->save();
    }

    /**
     * Adota mudanças da base nas regras escolhidas e dispensa as demais
     * sugestões atuais.
     *
     * @param  list<string>  $columns
     */
    public function adoptBase(self $global, array $columns): void
    {
        foreach (array_keys($this->pendingBaseChanges($global)) as $column) {
            if (in_array($column, $columns, true)) {
                $this->setAttribute($column, $global->getAttribute($column));
            }
        }

        $this->base_snapshot = $global->ruleValues();
        $this->base_version = (int) ($global->version ?? 1);
        $this->save();
    }

    /**
     * Valores das regras (sem identificação e controle de versão).
     *
     * @return array<string, mixed>
     */
    public function ruleValues(): array
    {
        $values = [];

        foreach (array_keys($this->getAttributes()) as $column) {
            if (! in_array($column, self::NOT_RULES, true)) {
                $values[$column] = $this->getAttribute($column);
            }
        }

        return $values;
    }

    /**
     * Mudanças da base que a campanha ainda não avaliou: regras em que a
     * base mudou desde o último instantâneo e cujo valor na campanha é
     * diferente do novo valor da base.
     *
     * @return array<string, array{campaign: mixed, base: mixed}>
     */
    public function pendingBaseChanges(?self $global): array
    {
        if ($this->game_session_id === null || $global === null) {
            return [];
        }

        $snapshot = (array) ($this->base_snapshot ?? []);
        $changes = [];

        foreach ($global->ruleValues() as $column => $baseValue) {
            $changedInBase = ! array_key_exists($column, $snapshot) || self::normalize($snapshot[$column]) !== self::normalize($baseValue);

            if ($changedInBase && self::normalize($this->getAttribute($column)) !== self::normalize($baseValue)) {
                $changes[$column] = ['campaign' => $this->getAttribute($column), 'base' => $baseValue];
            }
        }

        return $changes;
    }

    /**
     * Regras em que a campanha difere da base atual.
     *
     * @return list<string>
     */
    public function differencesFrom(?self $global): array
    {
        if ($global === null) {
            return [];
        }

        $base = $global->ruleValues();

        return array_values(array_filter(
            array_keys($base),
            fn (string $column): bool => self::normalize($this->getAttribute($column)) !== self::normalize($base[$column]),
        ));
    }

    /**
     * Valor comparável: números iguais com tipos diferentes ("2", 2, 2.0) e
     * vazio/nulo contam como iguais.
     */
    public static function normalize(mixed $value): string
    {
        if (is_array($value)) {
            return (string) json_encode(array_map(static fn (mixed $item): mixed => json_decode(self::normalize($item), true), $value), JSON_UNESCAPED_UNICODE);
        }

        if (is_string($value) && is_numeric($value)) {
            $value = $value + 0;
        }

        if (is_float($value) && floor($value) === $value) {
            $value = (int) $value;
        }

        if (is_bool($value)) {
            $value = (int) $value;
        }

        if ($value === '') {
            $value = null;
        }

        return (string) json_encode($value, JSON_UNESCAPED_UNICODE);
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
