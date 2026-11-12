<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\FormulaEvaluator;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\RuleSet;
use App\Models\Skill;
use App\Rules\Formula;
use App\Support\CampaignLibrary;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Regras de cálculo: as globais ("Configurações Base", só admin) e as de
 * cada campanha (mestre da campanha). Uma campanha sem regras próprias usa
 * as globais; ao salvar pela primeira vez, as regras dela são criadas.
 */
class RuleSetController extends Controller
{
    /** Campos numéricos: coluna => [mínimo, máximo]. */
    private const NUMBERS = [
        'max_attribute_points' => [0, 100000],
        'max_single_attribute_value' => [0, 100000],
        'initial_skill_points' => [0, 100000],
        'initial_power_points' => [0, 100000],
        'initial_money' => [0, 1000000000],
        'attr_points_per_level' => [0, 10000],
        'skill_points_per_level' => [0, 10000],
        'power_points_per_level' => [0, 10000],
        'npc_default_min_attr' => [-1000, 1000],
        'npc_default_max_attr' => [-1000, 1000],
        'npc_default_attr_points' => [0, 100000],
        'npc_default_skill_points' => [0, 100000],
        'npc_default_power_points' => [0, 100000],
    ];

    public const FORMULAS = [
        'pv' => 'PV máximo',
        'atp' => 'ATP máximo',
        'soco' => 'Soco',
        'chute' => 'Chute',
        'defesa' => 'Defesa',
        'esquiva' => 'Esquiva',
        'en' => 'EN',
        'dm' => 'DM',
        'skill_cost' => 'Custo de perícia',
        'power_cost' => 'Custo de poder',
    ];

    public function editGlobal(): View
    {
        return $this->form(RuleSet::query()->global()->first() ?? new RuleSet, null);
    }

    public function updateGlobal(Request $request): RedirectResponse
    {
        $this->save($request, RuleSet::query()->global()->first() ?? new RuleSet, null);

        return redirect()->route('catalog.rules.edit')
            ->with('status', 'Configurações base salvas! Valem para as campanhas sem regras próprias.');
    }

    public function editSession(GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        return $this->form($gameSession->ruleSet ?? RuleSet::copyOfGlobalFor($gameSession), $gameSession);
    }

    public function updateSession(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $this->save($request, $gameSession->ruleSet ?? RuleSet::copyOfGlobalFor($gameSession), $gameSession);

        return redirect()->route('gm.sessions.rules.edit', $gameSession)
            ->with('status', 'Regras da campanha salvas!');
    }

    /**
     * Sugestões da base: adota as regras marcadas e dispensa as demais.
     */
    public function adoptBase(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $ruleSet = $gameSession->ruleSet;
        $global = RuleSet::query()->global()->first();

        if ($ruleSet === null || $global === null) {
            return redirect()->route('gm.sessions.rules.edit', $gameSession);
        }

        $pending = array_keys($ruleSet->pendingBaseChanges($global));
        $data = $request->validate([
            'adopt' => ['array'],
            'adopt.*' => ['string', Rule::in($pending)],
        ]);

        $adopted = $data['adopt'] ?? [];
        $ruleSet->adoptBase($global, $adopted);

        return redirect()->route('gm.sessions.rules.edit', $gameSession)->with('status', match (true) {
            $adopted === [] => 'Sugestões da base dispensadas: a campanha mantém as regras atuais.',
            count($adopted) === count($pending) => 'Todas as mudanças da base foram adotadas!',
            default => count($adopted).' mudança(s) da base adotada(s); as demais foram dispensadas.',
        });
    }

    /**
     * Descarta as regras próprias: a campanha volta a herdar a base.
     */
    public function restoreBase(GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $gameSession->ruleSet()->delete();

        return redirect()->route('gm.sessions.rules.edit', $gameSession)
            ->with('status', 'A campanha voltou a usar as Configurações Base.');
    }

    private function form(RuleSet $ruleSet, ?GameSession $session): View
    {
        $attributes = is_array($ruleSet->getAttribute('attributes')) && $ruleSet->getAttribute('attributes') !== []
            ? $ruleSet->getAttribute('attributes')
            : config('arquivo.rules.attributes');

        $global = $session !== null ? RuleSet::query()->global()->first() : null;

        return view('rules.edit', [
            'ruleSet' => $ruleSet,
            'session' => $session,
            'pendingBase' => $session !== null && $ruleSet->exists ? $ruleSet->pendingBaseChanges($global) : [],
            'differences' => $session !== null && $ruleSet->exists ? $ruleSet->differencesFrom($global) : [],
            'pendingCounts' => $session !== null ? CampaignLibrary::for($session)->pendingCounts() : [],
            'numbers' => array_keys(self::NUMBERS),
            'formulas' => self::FORMULAS,
            'attributes' => array_values($attributes),
            'talentCategories' => array_values((array) ($ruleSet->talent_categories ?? [])),
            'skillTypes' => $this->typeRows($ruleSet->skill_type_vars ?: config('arquivo.rules.skill_type_vars')),
            'powerTypes' => $this->typeRows($ruleSet->power_type_vars ?? []),
            'calculationVars' => $this->typeRows($ruleSet->calculation_vars ?? []),
        ]);
    }

    private function save(Request $request, RuleSet $ruleSet, ?GameSession $session): void
    {
        $this->dropEmptyRows($request);

        $data = $request->validate($this->rules($session === null), [], $this->attributeNames());

        $previousSkillTypes = $this->renames($data['skill_types'] ?? []);
        $previousPowerTypes = $this->renames($data['power_types'] ?? []);

        $values = [];

        foreach (array_keys(self::NUMBERS) as $column) {
            $values[$column] = (int) $data[$column];
        }

        foreach (['diff_easy_mod', 'diff_hard_div', 'diff_extreme_div'] as $column) {
            $values[$column] = isset($data[$column]) ? (float) $data[$column] : null;
        }

        foreach (array_keys(self::FORMULAS) as $name) {
            $formula = trim((string) ($data[$name.'_formula'] ?? ''));
            $values[$name.'_formula'] = $formula !== '' ? $formula : null;
        }

        $values['attributes'] = array_map(static fn (array $row): array => [
            'id' => strtolower($row['id']),
            'label' => $row['label'],
        ], array_values($data['attributes']));
        $values['talent_categories'] = array_values(array_filter(array_map('trim', $data['talent_categories'] ?? [])));
        $values['skill_type_vars'] = $this->typeMap($data['skill_types'] ?? [], 'var');
        $values['power_type_vars'] = $this->typeMap($data['power_types'] ?? [], 'var');
        $values['calculation_vars'] = $this->typeMap($data['calculation_vars'] ?? [], 'formula');

        if ($session === null) {
            $values['enable_email_password_auth'] = (bool) ($data['enable_email_password_auth'] ?? false);
        }

        $values = $this->applyRenames($values, $previousSkillTypes, plurals: true);
        $values = $this->applyRenames($values, $previousPowerTypes, plurals: false);

        DB::transaction(function () use ($ruleSet, $session, $values, $previousSkillTypes, $previousPowerTypes): void {
            $ruleSet->forceFill($values);

            if ($session === null) {
                // Campanhas que herdavam a base recebem a mudança como sugestão.
                $ruleSet->saveAsGlobal();
            } else {
                $ruleSet->game_session_id = $session->id;
                $ruleSet->save();
            }

            // Perícias e poderes do catálogo acompanham o tipo renomeado.
            $this->renameCatalogTypes(Skill::class, $previousSkillTypes, $session);
            $this->renameCatalogTypes(Power::class, $previousPowerTypes, $session);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $global): array
    {
        $rules = [];

        foreach (self::NUMBERS as $column => [$min, $max]) {
            $rules[$column] = ['required', 'integer', 'min:'.$min, 'max:'.$max];
        }

        foreach (array_keys(self::FORMULAS) as $name) {
            $rules[$name.'_formula'] = ['nullable', 'string', 'max:255', new Formula];
        }

        return [
            ...$rules,
            'diff_easy_mod' => ['nullable', 'numeric', 'min:-100', 'max:100'],
            'diff_hard_div' => ['nullable', 'numeric', 'gt:0', 'max:100'],
            'diff_extreme_div' => ['nullable', 'numeric', 'gt:0', 'max:100'],
            'attributes' => ['required', 'array', 'min:1', 'max:20'],
            'attributes.*.id' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{0,15}$/', 'distinct'],
            'attributes.*.label' => ['required', 'string', 'max:64'],
            'talent_categories' => ['array', 'max:50'],
            'talent_categories.*' => ['required', 'string', 'max:64', 'distinct'],
            'skill_types' => ['array', 'max:50'],
            'skill_types.*.name' => ['required', 'string', 'max:64', 'distinct'],
            'skill_types.*.var' => ['nullable', 'string', 'max:255', new Formula],
            'skill_types.*.original' => ['nullable', 'string', 'max:64'],
            'power_types' => ['array', 'max:50'],
            'power_types.*.name' => ['required', 'string', 'max:64', 'distinct'],
            'power_types.*.var' => ['nullable', 'string', 'max:255', new Formula],
            'power_types.*.original' => ['nullable', 'string', 'max:64'],
            'calculation_vars' => ['array', 'max:50'],
            'calculation_vars.*.name' => ['required', 'string', 'regex:/^[A-Za-z_][A-Za-z0-9_]{0,31}$/', 'distinct'],
            'calculation_vars.*.formula' => ['required', 'string', 'max:255', new Formula],
            ...($global ? ['enable_email_password_auth' => ['boolean']] : []),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function attributeNames(): array
    {
        $names = [
            'attributes.*.id' => 'sigla do atributo',
            'attributes.*.label' => 'nome do atributo',
            'talent_categories.*' => 'categoria de talento',
            'skill_types.*.name' => 'tipo de perícia',
            'skill_types.*.var' => 'divisor do tipo de perícia',
            'power_types.*.name' => 'tipo de poder',
            'power_types.*.var' => 'divisor do tipo de poder',
            'calculation_vars.*.name' => 'nome da variável',
            'calculation_vars.*.formula' => 'fórmula da variável',
            'diff_easy_mod' => 'bônus do teste fácil',
            'diff_hard_div' => 'divisor do teste difícil',
            'diff_extreme_div' => 'divisor do teste extremo',
        ];

        foreach (self::FORMULAS as $name => $label) {
            $names[$name.'_formula'] = 'fórmula de '.mb_strtolower($label);
        }

        return $names;
    }

    /**
     * Linhas totalmente vazias das listas editáveis são ignoradas.
     */
    private function dropEmptyRows(Request $request): void
    {
        foreach (['attributes', 'skill_types', 'power_types', 'calculation_vars'] as $list) {
            $rows = array_filter((array) $request->input($list, []), static function (mixed $row): bool {
                if (! is_array($row)) {
                    return false;
                }

                unset($row['original']);

                return implode('', array_map(static fn (mixed $value): string => trim((string) $value), $row)) !== '';
            });

            $request->merge([$list => array_values($rows)]);
        }

        $request->merge([
            'talent_categories' => array_values(array_filter(
                (array) $request->input('talent_categories', []),
                static fn (mixed $name): bool => trim((string) $name) !== '',
            )),
        ]);

        // Siglas de atributo em minúsculas, como o sistema antigo gravava.
        $request->merge([
            'attributes' => array_map(static function (array $row): array {
                $row['id'] = strtolower(trim((string) ($row['id'] ?? '')));

                return $row;
            }, $request->input('attributes', [])),
        ]);
    }

    /**
     * @param  array<string, string>|null  $map
     * @return list<array{name: string, value: string}>
     */
    private function typeRows(?array $map): array
    {
        $rows = [];

        foreach ($map ?? [] as $name => $value) {
            $rows[] = ['name' => (string) $name, 'value' => (string) $value];
        }

        return $rows;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, string>
     */
    private function typeMap(array $rows, string $valueKey): array
    {
        $map = [];

        foreach ($rows as $row) {
            $value = trim((string) ($row[$valueKey] ?? ''));
            $map[trim((string) $row['name'])] = $value !== '' ? $value : '1';
        }

        return $map;
    }

    /**
     * Tipos renomeados: nome anterior => nome novo.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, string>
     */
    private function renames(array $rows): array
    {
        $renames = [];

        foreach ($rows as $row) {
            $original = trim((string) ($row['original'] ?? ''));
            $name = trim((string) $row['name']);

            if ($original !== '' && $original !== $name) {
                $renames[$original] = $name;
            }
        }

        return $renames;
    }

    /**
     * Atualiza as variáveis do tipo renomeado nas fórmulas (ex.: LUTA e
     * LUTAS viram BRIGA e BRIGAS), como o sistema antigo fazia.
     *
     * @param  array<string, mixed>  $values
     * @param  array<string, string>  $renames
     * @return array<string, mixed>
     */
    private function applyRenames(array $values, array $renames, bool $plurals): array
    {
        if ($renames === []) {
            return $values;
        }

        $replace = static function (?string $formula) use ($renames, $plurals): ?string {
            if ($formula === null) {
                return null;
            }

            foreach ($renames as $old => $new) {
                $pairs = [FormulaEvaluator::variableName($old) => FormulaEvaluator::variableName($new)];

                if ($plurals) {
                    foreach ($pairs as $from => $to) {
                        $pairs[self::pluralFormOf($from)] = self::pluralFormOf($to);
                    }
                }

                foreach ($pairs as $from => $to) {
                    $formula = (string) preg_replace('/(?<![A-Za-z0-9_])'.preg_quote($from, '/').'(?![A-Za-z0-9_])/i', $to, $formula);
                }
            }

            return $formula;
        };

        foreach (array_keys(self::FORMULAS) as $name) {
            $values[$name.'_formula'] = $replace($values[$name.'_formula']);
        }

        foreach (['skill_type_vars', 'power_type_vars', 'calculation_vars'] as $map) {
            $values[$map] = array_map(static fn (string $formula): string => (string) $replace($formula), $values[$map]);
        }

        return $values;
    }

    /**
     * Forma alternativa da variável de contagem: LUTA <-> LUTAS.
     */
    private static function pluralFormOf(string $name): string
    {
        return str_ends_with($name, 'S') ? substr($name, 0, -1) : $name.'S';
    }

    /**
     * @param  class-string<Skill|Power>  $model
     * @param  array<string, string>  $renames
     */
    private function renameCatalogTypes(string $model, array $renames, ?GameSession $session): void
    {
        foreach ($renames as $old => $new) {
            $bases = $model::query()->base()->where('type', $old)->get();

            // Na base, cada item renomeado chega às campanhas como sugestão.
            if ($session === null) {
                foreach ($bases as $base) {
                    $base->type = $new;
                    CampaignLibrary::baseUpdating($base);
                    $base->save();
                }

                continue;
            }

            // Na campanha, itens herdados ganham uma versão própria com o tipo novo; a base não muda.
            $library = CampaignLibrary::for($session);
            foreach ($bases as $base) {
                $library->versionOf($base);
            }

            $model::query()->where('game_session_id', $session->id)->where('type', $old)->update(['type' => $new]);
        }
    }
}
