<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\GameSession;
use App\Models\Talent;
use App\Support\CampaignLibrary;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Edição da ficha: dados básicos, liberação da edição pelo mestre,
 * modificadores manuais de talento, campanha do personagem e exclusão.
 */
class CharacterEditController extends Controller
{
    private const DISK = 'public';

    /**
     * Nome, classe e retrato. Quem edita: mestre da campanha ou dono com edição liberada.
     */
    public function updateDetails(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('editStats', $character);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'class' => ['nullable', 'string', 'max:255'],
            'image' => ['nullable', 'image', 'mimes:jpeg,png,webp,gif', 'max:4096'],
            'remove_image' => ['boolean'],
        ], [], ['name' => 'nome', 'class' => 'classe', 'image' => 'retrato']);

        $previous = $character->image_path;
        $character->fill(['name' => $data['name'], 'class' => $data['class'] ?? null]);

        if ($request->hasFile('image')) {
            $character->image_path = $request->file('image')->store('characters', self::DISK);
        } elseif ($request->boolean('remove_image')) {
            $character->image_path = null;
        }

        $character->save();

        if ($previous !== $character->image_path && $previous !== null && ! Str::startsWith($previous, ['http://', 'https://'])) {
            Storage::disk(self::DISK)->delete($previous);
        }

        return redirect()->to(route('characters.show', $character).'#dados')->with('status', 'Dados do personagem atualizados.');
    }

    /**
     * Liga ou desliga a edição da ficha pelo jogador (só o mestre).
     */
    public function toggleUnlock(Character $character): RedirectResponse
    {
        Gate::authorize('unlockStats', $character);

        $character->can_edit_stats = ! $character->can_edit_stats;
        $character->save();

        return redirect()->to(route('characters.show', $character).'#dados')
            ->with('status', $character->can_edit_stats ? 'Edição da ficha liberada para o jogador.' : 'Edição da ficha bloqueada.');
    }

    /**
     * Modificadores manuais dos talentos ({id: valor}); zero remove.
     */
    public function updateTalentMods(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('editStats', $character);

        $data = $request->validate([
            'talent_mods' => ['array'],
            'talent_mods.*' => ['nullable', 'integer', 'min:-100', 'max:100'],
        ], [], ['talent_mods.*' => 'modificador do talento']);

        $validIds = CampaignLibrary::for($character->gameSession)->entries(Talent::class)->keys()->map(static fn (int $id): string => (string) $id)->all();
        $mods = [];

        foreach ($data['talent_mods'] ?? [] as $talentId => $value) {
            if (in_array((string) $talentId, $validIds, true) && (int) $value !== 0) {
                $mods[(string) $talentId] = (int) $value;
            }
        }

        $character->talent_mods = $mods;
        $character->save();

        return redirect()->to(route('characters.show', $character).'#talentos')->with('status', 'Modificadores de talento salvos.');
    }

    /**
     * Vincula o personagem a uma campanha do usuário (como jogador ou mestre) ou o desvincula.
     */
    public function updateCampaign(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('update', $character);

        $user = $request->user();
        $allowed = GameSession::query()
            ->where(static function (Builder $query) use ($user): void {
                $query->where('gm_id', $user->id)
                    ->orWhereHas('players', static fn (Builder $players) => $players->whereKey($user->id));
            })
            ->pluck('id')
            ->all();

        $data = $request->validate([
            'game_session_id' => ['nullable', 'integer', Rule::in($allowed)],
        ], [
            'game_session_id.in' => 'Escolha uma campanha em que você joga ou é o mestre.',
        ]);

        $character->game_session_id = $data['game_session_id'] ?? null;
        $character->save();

        return redirect()->route('characters.show', $character)->with('status', $character->game_session_id
            ? 'Personagem vinculado à campanha.'
            : 'Personagem retirado da campanha.');
    }

    /**
     * Exclusão pelo próprio dono, a partir do painel inicial (como no sistema
     * antigo). Administradores excluem pelo painel admin; o mestre, só NPCs.
     */
    public function destroy(Character $character): RedirectResponse
    {
        Gate::authorize('delete', $character);

        $character->deleteWithFiles();

        return redirect()->route('dashboard')->with('status', '"'.$character->name.'" foi excluído.');
    }
}
