<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Game\Bestiary;
use App\Game\CharacterSheet;
use App\Game\GameRules;
use App\Game\NpcGenerator;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\CustomSound;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Support\CampaignLibrary;
use App\Support\Sounds;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Painel do Mestre de uma campanha (GMDashboard.tsx): a mesa com vida,
 * progressão e NPCs, o bestiário, o gerador de encontros, as anotações do
 * mestre e as configurações da campanha. As abas vêm por query string (?aba=).
 */
class GmSessionController extends Controller
{
    public const TABS = [
        'mesa' => ['A Mesa', 'users'],
        'bestiario' => ['Bestiário', 'skull'],
        'encontros' => ['Encontros', 'swords'],
        'sons' => ['Sons', 'volume'],
        'anotacoes' => ['Anotações', 'scroll'],
        'configuracoes' => ['Configurações', 'settings'],
    ];

    public const CHARACTER_FILTERS = ['todos' => 'Todos', 'jogadores' => 'Jogadores', 'npcs' => 'NPCs', 'monstros' => 'Monstros'];

    public function show(Request $request, GameSession $gameSession): View
    {
        Gate::authorize('update', $gameSession);

        $tab = array_key_exists((string) $request->query('aba'), self::TABS) ? (string) $request->query('aba') : 'mesa';
        $filter = array_key_exists((string) $request->query('tipo'), self::CHARACTER_FILTERS) ? (string) $request->query('tipo') : 'todos';
        $order = $request->query('ordem') === 'nivel' ? 'nivel' : 'nome';

        $gameSession->load(['players' => static fn ($query) => $query->orderBy('name')])
            ->loadCount(['players', 'characters', 'journalEntries']);

        $characters = $gameSession->characters()
            ->with(['user:id,name', 'skills', 'powers', 'traits', 'items'])
            ->when($filter === 'jogadores', static fn ($query) => $query->where('is_npc', false))
            ->when($filter === 'npcs', static fn ($query) => $query->where('is_npc', true)->where('is_monster', false))
            ->when($filter === 'monstros', static fn ($query) => $query->where('is_monster', true))
            ->when($order === 'nivel', static fn ($query) => $query->orderByDesc('level'))
            ->orderBy('name')
            ->get();

        $characters->each(static function (Character $character) use ($gameSession): void {
            $character->setRelation('gameSession', $gameSession);
            $character->setAttribute('max_pv', CharacterSheet::maxPv($character));
        });

        $rules = GameRules::forSession($gameSession);
        $levels = $gameSession->characters()->where('is_npc', false)->pluck('level')->map(static fn ($level): int => (int) $level)->all();

        return view('gm.sessions.show', [
            'session' => $gameSession,
            'tab' => $tab,
            'filter' => $filter,
            'order' => $order,
            'characters' => $characters,
            'progression' => $rules->progression(),
            'dungeonMaps' => $gameSession->mapsOfType(MapType::Dungeon),
            'monsters' => Bestiary::monsters(),
            'partyLevels' => $levels,
            'budgets' => Bestiary::partyBudgets($levels),
            'archetypes' => NpcGenerator::ARCHETYPES,
            'dangerLevels' => NpcGenerator::DANGER_LEVELS,
            'catalogItems' => $tab === 'configuracoes' ? CampaignLibrary::for($gameSession)->entries(CatalogItem::class)->values() : collect(),
            'libraryPending' => array_sum(CampaignLibrary::for($gameSession)->pendingCounts()) + count($gameSession->ruleSet?->pendingBaseChanges(RuleSet::query()->global()->first()) ?? []),
            'shopItemIds' => $tab === 'configuracoes' ? $gameSession->shopItems()->pluck('catalog_items.id')->all() : [],
            'library' => $tab === 'sons'
                ? CustomSound::query()->availableTo($request->user(), $gameSession)->with('user:id,name')->orderBy('category')->orderBy('name')->get()
                : collect(),
            'storedSounds' => $tab === 'sons' ? Sounds::stored($rules->ruleSet()) : [],
            'ownSoundRules' => $gameSession->ruleSet()->exists(),
        ]);
    }

    /**
     * Nome, descrição, imagem, situação e loja da campanha.
     */
    public function update(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validateWithBag('settings', [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remove_image' => ['boolean'],
            'active' => ['boolean'],
            'shop_enabled' => ['boolean'],
            'shop_items' => ['array'],
            'shop_items.*' => ['integer', Rule::in(CampaignLibrary::for($gameSession)->entries(CatalogItem::class)->keys()->all())],
        ], [], [
            'name' => 'nome',
            'description' => 'descrição',
            'image' => 'imagem',
            'shop_items.*' => 'item da loja',
        ]);

        $gameSession->fill([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'active' => $request->boolean('active'),
            'shop_enabled' => $request->boolean('shop_enabled'),
        ]);

        if ($request->hasFile('image') || $request->boolean('remove_image')) {
            self::deleteStoredFile($gameSession->image_path);
            $gameSession->image_path = $request->hasFile('image') ? $request->file('image')->store('sessions', 'public') : null;
        }

        $gameSession->save();
        $gameSession->shopItems()->sync($data['shop_items'] ?? []);

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'configuracoes'])->with('status', 'Configurações da campanha salvas.');
    }

    /**
     * Anotações privadas do mestre (gmNotes).
     */
    public function updateNotes(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validate(['gm_notes' => ['nullable', 'string', 'max:65000']], [], ['gm_notes' => 'anotações']);

        $gameSession->update(['gm_notes' => $data['gm_notes'] ?? null]);

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'anotacoes'])->with('status', 'Notas do mestre salvas!');
    }

    /**
     * Excluir a campanha: o nome precisa ser digitado para confirmar.
     */
    public function destroy(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('delete', $gameSession);

        $request->validateWithBag('deleteSession', [
            'confirmation' => ['required', 'string', Rule::in([$gameSession->name])],
        ], [
            'confirmation.in' => 'Digite o nome exato da campanha para confirmar.',
            'confirmation.required' => 'Digite o nome exato da campanha para confirmar.',
        ]);

        self::deleteStoredFile($gameSession->image_path);
        $gameSession->delete();

        return redirect()->route('dashboard')->with('status', 'Campanha "'.$gameSession->name.'" excluída.');
    }

    private static function deleteStoredFile(?string $path): void
    {
        if ($path !== null && $path !== '' && ! str_starts_with($path, 'http')) {
            Storage::disk('public')->delete($path);
        }
    }
}
