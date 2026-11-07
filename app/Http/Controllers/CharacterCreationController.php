<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\CharacterDraft;
use App\Game\CharacterSheet;
use App\Game\GameRules;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CharacterItem;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\RuleSet;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Criação de Personagem (CharacterCreation.tsx do sistema antigo): assistente
 * de 7 passos numa página só. O navegador monta o rascunho e mostra os custos
 * ao vivo; aqui o rascunho inteiro é validado de novo antes de virar ficha.
 */
class CharacterCreationController extends Controller
{
    /** Ícones que o jogador pode escolher (nomes do sistema antigo). */
    public const ICONS = ['Shield', 'Sword', 'Flame', 'Eye', 'Zap', 'Brain', 'Heart', 'Activity', 'Scroll', 'Dice6', 'Sparkles'];

    public const COLORS = ['arcane' => 'Arcano', 'ember' => 'Brasa', 'gold' => 'Ouro'];

    public function create(Request $request): View
    {
        Gate::authorize('create', Character::class);

        $user = $request->user();
        $sessions = $this->sessionsFor($user)->load('gm:id,name');
        $global = RuleSet::query()->global()->first();
        $sessionRules = RuleSet::query()->whereIn('game_session_id', $sessions->pluck('id'))->get()->keyBy('game_session_id');

        return view('characters.create', [
            'config' => [
                'sessions' => $sessions->map(static fn (GameSession $session): array => [
                    'id' => $session->id,
                    'name' => $session->name,
                    'gm' => $session->gm?->name,
                    'is_gm' => $session->gm_id === $user->id,
                    'rules' => (new GameRules($sessionRules->get($session->id) ?? $global))->toArray(),
                ])->values(),
                'skills' => Skill::query()->orderBy('name')->get(['id', 'name', 'type', 'purchase_cost', 'atp_cost', 'damage', 'description', 'difficulty_formula', 'game_session_id']),
                'powers' => Power::query()->orderBy('name')->get(['id', 'name', 'type', 'purchase_cost', 'cost', 'effect', 'description', 'difficulty_formula', 'game_session_id']),
                'traits' => CharacterTrait::query()->orderBy('name')->get()->map(static fn (CharacterTrait $trait): array => [
                    'id' => $trait->id,
                    'name' => $trait->name,
                    'type' => $trait->type?->value,
                    'modifier' => $trait->modifier,
                    'target' => $trait->modifier_attribute ?? ($trait->modifier_talent_id !== null ? (string) $trait->modifier_talent_id : null),
                    'effect' => $trait->effect,
                    'description' => $trait->description,
                ]),
                'talents' => Talent::query()->orderBy('name')->get(['id', 'name']),
                'catalog' => CatalogItem::query()->where('is_starting_item', true)->orderBy('category')->orderBy('name')
                    ->get(['id', 'name', 'category', 'rarity', 'value', 'weight', 'damage', 'defense', 'description']),
                'categories' => array_diff_key(CatalogItem::CATEGORIES, ['Geral' => true]),
                'icons' => self::ICONS,
                'colors' => self::COLORS,
                'old' => json_decode((string) old('payload', 'null'), true),
                'suggestionUrl' => route('suggestions.store'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', Character::class);

        $user = $request->user();
        $request->validate([
            'payload' => ['required', 'string', 'max:200000'],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,webp,gif', 'max:4096'],
        ], [], ['image' => 'retrato']);

        $payload = json_decode($request->string('payload')->toString(), true);
        $payload = is_array($payload) ? $payload : [];
        $sessions = $this->sessionsFor($user);

        $data = Validator::make($payload, [
            'basics.name' => ['required', 'string', 'max:255'],
            'basics.class' => ['nullable', 'string', 'max:255'],
            'basics.color' => ['required', Rule::in(array_keys(self::COLORS))],
            'basics.icon' => ['required', Rule::in(self::ICONS)],
            'basics.game_session_id' => ['required', 'integer', Rule::in($sessions->pluck('id')->all())],
            'traits' => ['array', 'max:40'],
            'traits.*' => ['integer', 'distinct'],
            'stats' => ['array'],
            'stats.*' => ['integer', 'min:0', 'max:1000'],
            'skills' => ['array', 'max:60'],
            'skills.*.id' => ['required', 'integer', 'distinct'],
            'skills.*.level' => ['required', 'integer', 'min:1', 'max:20'],
            'skills.*.type' => ['nullable', 'string', 'max:64'],
            'skills.*.description' => ['nullable', 'string', 'max:2000'],
            'powers' => ['array', 'max:60'],
            'powers.*.id' => ['required', 'integer', 'distinct'],
            'powers.*.level' => ['required', 'integer', 'min:1', 'max:20'],
            'powers.*.type' => ['nullable', 'string', 'max:64'],
            'powers.*.description' => ['nullable', 'string', 'max:2000'],
            'equipment.catalog' => ['array', 'max:60'],
            'equipment.catalog.*' => ['integer'],
            'equipment.custom' => ['array', 'max:40'],
            'equipment.custom.*.name' => ['required', 'string', 'max:255'],
            'equipment.custom.*.category' => ['required', Rule::in(array_keys(CatalogItem::CATEGORIES))],
            'equipment.custom.*.damage' => ['nullable', 'string', 'max:64'],
            'equipment.custom.*.defense' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'equipment.custom.*.description' => ['nullable', 'string', 'max:2000'],
        ], [
            'basics.game_session_id.required' => 'Escolha a campanha do personagem.',
            'basics.game_session_id.in' => 'Escolha uma campanha disponível.',
        ], [
            'basics.name' => 'nome da lenda',
            'basics.class' => 'classe',
            'basics.color' => 'cor',
            'basics.icon' => 'ícone',
            'equipment.custom.*.name' => 'nome do item',
        ])->validate();

        $session = $sessions->firstWhere('id', (int) $data['basics']['game_session_id']);
        $rules = GameRules::forSession($session);
        $inScope = static function (Builder $query) use ($session): void {
            $query->whereNull('game_session_id')->orWhere('game_session_id', $session->id);
        };

        $traits = CharacterTrait::query()->whereIn('id', $data['traits'] ?? [])->get();
        $skillModels = Skill::query()->where($inScope)->whereIn('id', array_column($data['skills'] ?? [], 'id'))->get()->keyBy('id');
        $powerModels = Power::query()->where($inScope)->whereIn('id', array_column($data['powers'] ?? [], 'id'))->get()->keyBy('id');
        $catalog = CatalogItem::query()->where('is_starting_item', true)->whereIn('id', $data['equipment']['catalog'] ?? [])->get()->keyBy('id');

        $errors = [];

        if ($traits->count() !== count($data['traits'] ?? [])) {
            $errors['traits'] = 'Algum traço escolhido não existe mais na biblioteca.';
        }

        $skills = $this->abilities($data['skills'] ?? [], $skillModels, array_keys($rules->skillTypeVars()) ?: $rules->skillCategories(), 'skill', $errors);
        $powers = $this->abilities($data['powers'] ?? [], $powerModels, $rules->powerTypes(), 'power', $errors);

        $purchases = [];
        foreach ($data['equipment']['catalog'] ?? [] as $itemId) {
            if (! $catalog->has($itemId)) {
                $errors['equipment'] = 'Algum item escolhido não faz parte do equipamento inicial.';
                break;
            }
            $purchases[] = $catalog->get($itemId);
        }

        $stats = [];
        foreach ($rules->attributes() as $attribute) {
            $id = strtolower($attribute['id']);
            $stats[$id] = (int) ($data['stats'][$id] ?? $data['stats'][$attribute['id']] ?? 0);
        }

        $talents = Talent::query()->where($inScope)->get();
        $draft = new CharacterDraft($rules, $stats, $traits, $skills, $powers, $purchases, $talents);
        $errors = [...$errors, ...$draft->errors()];

        if ($errors !== []) {
            return back()->withErrors($errors)->withInput($request->only('payload'));
        }

        $character = DB::transaction(function () use ($request, $user, $session, $data, $stats, $traits, $skills, $powers, $purchases, $draft, $rules, $talents): Character {
            $character = new Character([
                'name' => $data['basics']['name'],
                'class' => ($data['basics']['class'] ?? '') !== '' ? $data['basics']['class'] : 'Aventureiro',
                'color' => $data['basics']['color'],
                'icon' => $data['basics']['icon'],
                'level' => 1,
                'xp' => 0,
                'xp_max' => 1000,
                'stats' => $stats,
                'base_stats' => $stats,
                'stats_mods' => [],
                'talent_mods' => [],
                'sanity' => CharacterSheet::TRACK_MAX,
                ...$draft->remaining(),
            ]);
            $character->user_id = $user->id;
            $character->game_session_id = $session->id;
            $character->can_edit_stats = false;

            if ($request->hasFile('image')) {
                $character->image_path = $request->file('image')->store('characters', 'public');
            }

            $character->save();

            $character->traits()->sync($traits->pluck('id'));
            foreach ($skills as $row) {
                $character->skills()->attach($row['skill']->id, ['level' => $row['level'], 'type' => $row['type'], 'description' => $row['description']]);
            }
            foreach ($powers as $row) {
                $character->powers()->attach($row['power']->id, ['level' => $row['level'], 'type' => $row['type'], 'description' => $row['description']]);
            }

            $this->createItems($character, $purchases, $data['equipment']['custom'] ?? []);

            // Quem cria um personagem numa campanha alheia passa a jogar nela.
            if ($session->gm_id !== $user->id && ! $session->players()->whereKey($user->id)->exists()) {
                $session->players()->attach($user->id);
            }

            // PV e ATP começam cheios.
            $character->load(['skills', 'powers', 'traits', 'items']);
            $derived = CharacterSheet::for($character, $rules, $talents)->data['derived'];
            $character->forceFill(['current_pv' => max(0, $derived['pv']), 'current_atp' => max(0, $derived['atp'])])->save();

            return $character;
        });

        return redirect()->route('characters.show', $character)->with('status', 'Personagem "'.$character->name.'" forjado com sucesso!');
    }

    /**
     * Campanhas em que o personagem pode nascer: as ativas e as que o usuário mestra.
     *
     * @return Collection<int, GameSession>
     */
    private function sessionsFor(User $user): Collection
    {
        return GameSession::query()
            ->where(static fn (Builder $query) => $query->where('active', true)->orWhere('gm_id', $user->id))
            ->orderBy('name')
            ->get();
    }

    /**
     * Confere perícias/poderes do rascunho contra a biblioteca e os tipos das regras.
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  \Illuminate\Support\Collection<int, Skill|Power>  $models
     * @param  list<string>  $types
     * @param  array<string, string>  $errors
     * @return list<array<string, mixed>>
     */
    private function abilities(array $rows, \Illuminate\Support\Collection $models, array $types, string $kind, array &$errors): array
    {
        $result = [];

        foreach ($rows as $row) {
            $model = $models->get((int) $row['id']);

            if ($model === null) {
                $errors[$kind === 'skill' ? 'skills' : 'powers'] = 'Algum(a) '.($kind === 'skill' ? 'perícia' : 'poder').' escolhido(a) não está disponível nesta campanha.';

                continue;
            }

            $type = trim((string) ($row['type'] ?? '')) ?: $model->type;

            if ($type !== $model->type && ! in_array($type, $types, true)) {
                $errors[$kind === 'skill' ? 'skills' : 'powers'] = 'Tipo "'.$type.'" não existe nas regras da campanha.';
            }

            $result[] = [
                $kind => $model,
                'level' => (int) $row['level'],
                'type' => $type,
                'description' => trim((string) ($row['description'] ?? '')) ?: null,
            ];
        }

        return $result;
    }

    /**
     * Itens iniciais: os do catálogo (munição e consumíveis se acumulam) e os próprios.
     *
     * @param  list<CatalogItem>  $purchases
     * @param  list<array<string, mixed>>  $custom
     */
    private function createItems(Character $character, array $purchases, array $custom): void
    {
        $position = 0;
        $stacks = [];

        foreach ($purchases as $item) {
            if (in_array($item->category, CatalogItem::STACKABLE_CATEGORIES, true) && isset($stacks[$item->id])) {
                $stacks[$item->id]->increment('quantity');

                continue;
            }

            $created = new CharacterItem([
                'catalog_item_id' => $item->id,
                'name' => $item->name,
                'category' => $item->category,
                'rarity' => CatalogItem::normalizeRarity($item->rarity),
                'description' => $item->description,
                'damage' => $item->damage,
                'defense' => $item->defense,
                'weight' => (float) $item->weight,
                'value' => (int) $item->value,
                'quantity' => 1,
                'equipped' => false,
                'stats' => $item->stats ?? [],
                'image_path' => $item->image_path,
            ]);
            $created->position = $position++;
            $character->items()->save($created);
            $stacks[$item->id] = $created;
        }

        foreach ($custom as $row) {
            $created = new CharacterItem([
                'name' => $row['name'],
                'category' => $row['category'],
                'rarity' => 'Common',
                'description' => $row['description'] ?? null,
                'damage' => $row['damage'] ?? null,
                'defense' => (int) ($row['defense'] ?? 0),
                'quantity' => 1,
                'equipped' => false,
                'stats' => [],
            ]);
            $created->position = $position++;
            $character->items()->save($created);
        }
    }
}
