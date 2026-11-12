<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\MapType;
use App\Enums\TestDifficulty;
use App\Game\CharacterSheet;
use App\Game\DiceRoller;
use App\Game\GameRules;
use App\Models\CampaignMap;
use App\Models\Character;
use App\Models\CharacterTrait;
use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use App\Support\CampaignLibrary;
use App\Support\Navigation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Ficha Geral (CharacterSheet.tsx do sistema antigo): leitura dos valores
 * calculados, testes rápidos e o estado atual (PV, ATP, proteção...).
 */
class CharacterSheetController extends Controller
{
    /**
     * /ficha: com ?personagem=ID (links antigos e cartões) abre a ficha;
     * sem personagem, lista os do usuário (com um só, abre direto).
     */
    public function index(Request $request): View|RedirectResponse
    {
        if ($request->filled('personagem')) {
            return redirect()->route('characters.show', (int) $request->query('personagem'));
        }

        $characters = $request->user()->characters()->orderBy('name')->get();

        if ($characters->count() === 1) {
            return redirect()->route('characters.show', $characters->first());
        }

        return view('characters.choose', ['characters' => $characters]);
    }

    public function show(Request $request, Character $character): View
    {
        Gate::authorize('view', $character);

        $character->load(['skills', 'powers', 'traits', 'items', 'gameSession:id,name,gm_id,image_path', 'user:id,name']);
        $rules = GameRules::forSession($character->gameSession);
        $sheet = CharacterSheet::for($character, $rules, $this->talentsFor($character));

        $user = $request->user();
        $canEditStats = $user->can('editStats', $character);
        $canEdit = $user->can('update', $character);
        $isGm = $user->can('unlockStats', $character);

        // Mapas da campanha do personagem: o mestre vê todos, com a imagem real; o jogador,
        // só os ativos, com a miniatura genérica (a real revelaria o terreno). Como nas telas
        // de mapa (AuthorizesMapAccess), o mestre ou admin no modo Jogador vê como jogador.
        $session = $character->gameSession;
        $mapsAsGm = $session !== null && $user->can('update', $session) && Navigation::for($request)->isGmView();
        $campaignMaps = $session !== null && $user->can('view', $session)
            ? $session->mapsOfType(MapType::World)->concat($session->mapsOfType(MapType::Dungeon))
                ->filter(static fn (CampaignMap $map): bool => $mapsAsGm || $map->active_in_session)
                ->values()
            : collect();

        return view('characters.show', [
            'campaignMaps' => $campaignMaps,
            'mapsAsGm' => $mapsAsGm,
            'character' => $character,
            'sheet' => $sheet->data,
            'rules' => $rules,
            'canEdit' => $canEdit,
            'canEditStats' => $canEditStats,
            'isGm' => $isGm,
            'library' => $canEditStats ? $this->libraryFor($character) : null,
            'sessions' => $canEdit ? GameSession::query()
                ->where(static function (Builder $query) use ($user): void {
                    $query->where('gm_id', $user->id)
                        ->orWhereHas('players', static fn (Builder $players) => $players->whereKey($user->id));
                })
                ->orderBy('name')
                ->get(['id', 'name']) : collect(),
            'test' => session('test'),
        ]);
    }

    /**
     * Teste rápido "menor é melhor" com dificuldade. O valor-alvo é sempre
     * calculado aqui, nunca recebido do navegador.
     */
    public function test(Request $request, Character $character, DiceRoller $roller): RedirectResponse|JsonResponse
    {
        Gate::authorize('update', $character);

        $data = $request->validate([
            'target' => ['required', 'string', 'max:64'],
            'difficulty' => ['required', Rule::enum(TestDifficulty::class)],
        ]);

        $character->load(['skills', 'powers', 'traits', 'items', 'gameSession']);
        $rules = GameRules::forSession($character->gameSession);
        $target = CharacterSheet::for($character, $rules, $this->talentsFor($character))->testTarget($data['target']);

        abort_if($target === null, 404);

        $difficulty = TestDifficulty::from($data['difficulty']);
        $roll = $roller->test($target['value'], $difficulty, $rules, $target['sides']);
        $label = $target['label'].' ['.$difficulty->label().']';

        // Com campanha, o resultado também vai para o chat da sessão.
        $session = $character->gameSession;
        $postedToChat = $session !== null && $request->user()->can('view', $session);
        if ($postedToChat) {
            ChatMessage::postRoll(
                $session,
                $request->user(),
                $character->name,
                $label,
                $roll->roll,
                $roll->detail(),
                [['die' => '1D'.$roll->sides, 'values' => [$roll->roll]]],
                $roll->success,
            );
        }

        $result = [
            'target' => $data['target'],
            'label' => $label,
            ...$roll->toArray(),
        ];

        // A ficha rola pela janela de rolagem (x-roll-dialog), sem recarregar a página.
        if ($request->expectsJson()) {
            return response()->json([
                'result' => [
                    'title' => $target['label'],
                    'label' => 'Teste '.$difficulty->label(),
                    'value' => $roll->roll,
                    'outcome' => match (true) {
                        $roll->isCritical => 'critical',
                        $roll->isFumble => 'fumble',
                        $roll->success => 'success',
                        default => 'failure',
                    },
                    'detail' => $roll->detail(),
                    'note' => $postedToChat ? 'Enviado ao chat da campanha.' : null,
                ],
                'test' => $result,
            ]);
        }

        return redirect()
            ->to(route('characters.show', $character).'#'.self::anchorFor($data['target']))
            ->with('test', $result);
    }

    /**
     * Estado atual: PV, PV temporário, ATP, proteção, sanidade e despertar,
     * limitados pelos máximos calculados da ficha.
     */
    public function updateVitals(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('update', $character);

        $character->load(['skills', 'powers', 'traits', 'items', 'gameSession']);
        $sheet = CharacterSheet::for($character, GameRules::forSession($character->gameSession), $this->talentsFor($character))->data;

        $data = $request->validate([
            'current_pv' => ['required', 'integer', 'min:-9999', 'max:'.max(0, $sheet['derived']['pv'])],
            'temp_pv' => ['required', 'integer', 'min:0', 'max:9999'],
            'current_atp' => ['required', 'integer', 'min:0', 'max:'.max(0, $sheet['derived']['atp'])],
            'protection' => ['required', 'integer', 'min:0', 'max:'.$sheet['armor_bonus']],
            'sanity' => ['required', 'integer', 'min:0', 'max:'.CharacterSheet::TRACK_MAX],
            'awakening' => ['required', 'integer', 'min:0', 'max:'.CharacterSheet::TRACK_MAX],
        ], [
            'protection.max' => 'A proteção não pode passar da defesa das armaduras equipadas (:max).',
        ], [
            'current_pv' => 'PV atual',
            'temp_pv' => 'PV temporário',
            'current_atp' => 'ATP atual',
            'protection' => 'proteção',
            'sanity' => 'sanidade',
            'awakening' => 'despertar',
        ]);

        $character->update($data);

        return redirect()->to(route('characters.show', $character).'#estado')->with('status', 'Estado atualizado.');
    }

    /**
     * Talentos da campanha do personagem (base com as alterações da campanha).
     *
     * @return Collection<int, Talent>
     */
    private function talentsFor(Character $character): Collection
    {
        return CampaignLibrary::for($character->gameSession)->entries(Talent::class)->values();
    }

    /**
     * Itens da biblioteca da campanha que ainda não estão na ficha.
     *
     * @return array{skills: Collection<int, Skill>, powers: Collection<int, Power>, traits: Collection<int, CharacterTrait>}
     */
    private function libraryFor(Character $character): array
    {
        $library = CampaignLibrary::for($character->gameSession);

        return [
            'skills' => $library->entries(Skill::class)->except($character->skills->modelKeys())->values(),
            'powers' => $library->entries(Power::class)->except($character->powers->modelKeys())->values(),
            'traits' => $library->entries(CharacterTrait::class)->except($character->traits->modelKeys())
                ->sortBy(static fn (CharacterTrait $trait): string => ($trait->type?->value ?? '').mb_strtolower($trait->name))
                ->values(),
        ];
    }

    private static function anchorFor(string $target): string
    {
        return match (strtok($target, ':')) {
            'attr' => 'atributos',
            'talent' => 'talentos',
            'skill' => 'pericias',
            'power' => 'poderes',
            default => 'combate',
        };
    }
}
