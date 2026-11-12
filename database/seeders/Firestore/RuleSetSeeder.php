<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Enums\UserRole;
use App\Models\RoleFeature;
use App\Models\RuleSet;
use Illuminate\Database\Seeder;

/**
 * Configuração global (globalSettings/config) e funcionalidades por papel
 * (globalSettings/menuFeatures).
 */
class RuleSetSeeder extends Seeder
{
    use ImportsFirestoreData;

    /**
     * Converte os campos de regras do Firebase (iguais na configuração
     * global e nas sessões) para as colunas de rule_sets.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function attributesFrom(array $data): array
    {
        $int = static fn (string $key, int $default = 0): int => is_numeric($data[$key] ?? null) ? (int) $data[$key] : $default;
        // Ausente fica nulo: os padrões do sistema (config/arquivo.php) são aplicados no cálculo.
        $float = static fn (string $key): ?float => is_numeric($data[$key] ?? null) ? (float) $data[$key] : null;
        $string = static fn (string $key): ?string => is_string($data[$key] ?? null) && trim($data[$key]) !== ''
            ? mb_substr(trim($data[$key]), 0, 255)
            : null;
        $array = static fn (string $key): ?array => is_array($data[$key] ?? null) ? $data[$key] : null;

        return [
            'max_attribute_points' => $int('maxAttributePoints'),
            'max_single_attribute_value' => $int('maxSingleAttributeValue'),
            'initial_skill_points' => $int('initialSkillPoints'),
            'initial_power_points' => $int('initialPowerPoints'),
            'initial_money' => $int('initialMoney'),
            'attr_points_per_level' => $int('attrPointsPerLevel'),
            'skill_points_per_level' => $int('skillPointsPerLevel'),
            'power_points_per_level' => $int('powerPointsPerLevel'),
            'npc_default_min_attr' => $int('npcDefaultMinAttr'),
            'npc_default_max_attr' => $int('npcDefaultMaxAttr'),
            'npc_default_attr_points' => $int('npcDefaultAttrPoints'),
            'npc_default_skill_points' => $int('npcDefaultSkillPoints'),
            'npc_default_power_points' => $int('npcDefaultPowerPoints'),
            'diff_easy_mod' => $float('diffEasyMod'),
            'diff_hard_div' => $float('diffHardDiv'),
            'diff_extreme_div' => $float('diffExtremeDiv'),
            'pv_formula' => $string('pvFormula'),
            'atp_formula' => $string('atpFormula'),
            'soco_formula' => $string('socoFormula'),
            'chute_formula' => $string('chuteFormula'),
            'defesa_formula' => $string('defesaFormula'),
            'esquiva_formula' => $string('esquivaFormula'),
            'en_formula' => $string('enFormula'),
            'dm_formula' => $string('dmFormula'),
            'skill_cost_formula' => $string('skillCostFormula'),
            'power_cost_formula' => $string('powerCostFormula'),
            'skill_type_vars' => $array('skillTypeVars'),
            'power_type_vars' => $array('powerTypeVars'),
            'calculation_vars' => $array('calculationVars'),
            'attributes' => $array('attributes'),
            'talent_categories' => $array('talentCategories'),
            'dice_roll_sound' => $string('diceRollSound'),
            'critical_sound' => $string('criticalSound'),
            'fumble_sound' => $string('fumbleSound'),
            'success_sound' => $string('successSound'),
            'failure_sound' => $string('failureSound'),
            'enable_email_password_auth' => (bool) ($data['enableEmailPasswordAuth'] ?? true),
        ];
    }

    /**
     * O documento traz regras de jogo (e não só metadados)?
     *
     * @param  array<string, mixed>  $data
     */
    public static function hasRules(array $data): bool
    {
        foreach (self::RULE_KEYS as $key) {
            if (isset($data[$key])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Regras de uma campanha: as globais com os campos da campanha por cima,
     * como o sistema antigo fazia ({...globais, ...campanha}).
     *
     * @param  array<string, mixed>  $sessionData
     * @return array<string, mixed>
     */
    public static function sessionAttributesFrom(array $sessionData): array
    {
        $global = FirestoreDump::document('globalSettings', 'config') ?? [];

        return self::attributesFrom([
            ...array_intersect_key($global, array_flip(self::RULE_KEYS)),
            ...array_intersect_key($sessionData, array_flip(self::RULE_KEYS)),
        ]);
    }

    /** Campos de regra que uma campanha pode sobrescrever. */
    private const RULE_KEYS = [
        'maxAttributePoints', 'maxSingleAttributeValue', 'initialSkillPoints', 'initialPowerPoints', 'initialMoney',
        'attrPointsPerLevel', 'skillPointsPerLevel', 'powerPointsPerLevel',
        'npcDefaultMinAttr', 'npcDefaultMaxAttr', 'npcDefaultAttrPoints', 'npcDefaultSkillPoints', 'npcDefaultPowerPoints',
        'diffEasyMod', 'diffHardDiv', 'diffExtremeDiv',
        'pvFormula', 'atpFormula', 'socoFormula', 'chuteFormula', 'defesaFormula', 'esquivaFormula', 'enFormula', 'dmFormula',
        'skillCostFormula', 'powerCostFormula',
        'skillTypeVars', 'powerTypeVars', 'calculationVars', 'attributes', 'talentCategories',
        'diceRollSound', 'criticalSound', 'fumbleSound', 'successSound', 'failureSound',
    ];

    public function run(): void
    {
        $config = FirestoreDump::document('globalSettings', 'config');

        if ($config !== null) {
            $ruleSet = RuleSet::query()->global()->firstOrNew();
            $ruleSet->forceFill(self::attributesFrom($config))->save();

            // Regras de campanha importadas (GameSessionSeeder) passam a ter a base
            // importada como referência: só mudanças futuras da base viram sugestão.
            $global = $ruleSet->fresh();

            RuleSet::query()
                ->whereNotNull('game_session_id')
                ->whereNull('base_snapshot')
                ->each(static function (RuleSet $campaign) use ($global): void {
                    $campaign->base_snapshot = $global->ruleValues();
                    $campaign->base_version = (int) ($global->version ?? 1);
                    $campaign->save();
                });
        }

        $features = 0;

        foreach (FirestoreDump::document('globalSettings', 'menuFeatures') ?? [] as $role => $flags) {
            if (UserRole::tryFrom((string) $role) === null || ! is_array($flags)) {
                continue;
            }

            foreach ($flags as $feature => $enabled) {
                RoleFeature::query()->updateOrCreate(
                    ['role' => $role, 'feature' => mb_substr((string) $feature, 0, 64)],
                    ['enabled' => (bool) $enabled],
                );
                $features++;
            }
        }

        $this->report('Configuração global', $config !== null ? 1 : 0);
        $this->report('Permissões de menu por papel', $features);
    }
}
