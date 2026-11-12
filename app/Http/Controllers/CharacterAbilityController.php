<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\CharacterTrait;
use App\Models\Power;
use App\Models\Skill;
use App\Support\CampaignLibrary;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Perícias, poderes e traços da ficha, vindos das bibliotecas. Como na ficha
 * antiga, adicionar gasta o custo de compra em pontos e remover devolve.
 */
class CharacterAbilityController extends Controller
{
    public function storeSkill(Request $request, Character $character): RedirectResponse
    {
        return $this->store($request, $character, Skill::class, 'skills', 'skill_points', 'pericias', 'perícia');
    }

    public function destroySkill(Character $character, Skill $skill): RedirectResponse
    {
        return $this->destroy($character, $skill, 'skills', 'skill_points', 'pericias', 'Perícia');
    }

    public function storePower(Request $request, Character $character): RedirectResponse
    {
        return $this->store($request, $character, Power::class, 'powers', 'power_points', 'poderes', 'poder');
    }

    public function destroyPower(Character $character, Power $power): RedirectResponse
    {
        return $this->destroy($character, $power, 'powers', 'power_points', 'poderes', 'Poder');
    }

    public function storeTrait(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('editStats', $character);

        $library = CampaignLibrary::for($character->gameSession)->entries(CharacterTrait::class);
        $data = $request->validate([
            // Só itens visíveis na biblioteca da campanha do personagem.
            'trait_id' => ['required', 'integer', Rule::in($library->keys()->all())],
        ], ['trait_id.in' => 'Este traço não está disponível na campanha.'], ['trait_id' => 'vantagem ou defeito']);

        if ($character->traits()->whereKey($data['trait_id'])->exists()) {
            return back()->withErrors(['trait_id' => 'Este traço já está na ficha.']);
        }

        $character->traits()->attach($data['trait_id']);
        $trait = $library->get((int) $data['trait_id']);

        return redirect()->to(route('characters.show', $character).'#tracos')->with('status', 'Traço "'.$trait->name.'" adicionado à ficha!');
    }

    public function destroyTrait(Character $character, CharacterTrait $trait): RedirectResponse
    {
        Gate::authorize('editStats', $character);

        $character->traits()->detach($trait->id);

        return redirect()->to(route('characters.show', $character).'#tracos')->with('status', 'Traço removido da ficha.');
    }

    /**
     * @param  class-string<Skill|Power>  $model
     */
    private function store(Request $request, Character $character, string $model, string $relation, string $pointsColumn, string $anchor, string $label): RedirectResponse
    {
        Gate::authorize('editStats', $character);

        // Só itens visíveis na biblioteca da campanha (com o custo da versão da campanha).
        $library = CampaignLibrary::for($character->gameSession)->entries($model);
        $data = $request->validate([
            'ability_id' => ['required', 'integer', Rule::in($library->keys()->all())],
        ], ['ability_id.in' => 'Esta '.$label.' não está disponível na campanha.'], ['ability_id' => $label]);

        $ability = $library->get((int) $data['ability_id']);

        $error = DB::transaction(static function () use ($character, $ability, $relation, $pointsColumn, $label): ?string {
            $locked = Character::query()->lockForUpdate()->findOrFail($character->id);

            if ($locked->{$relation}()->whereKey($ability->id)->exists()) {
                return 'Esta '.$label.' já está na ficha.';
            }

            if ($locked->{$pointsColumn} < (int) $ability->purchase_cost) {
                return 'Pontos de '.$label.' insuficientes! (Custo: '.(int) $ability->purchase_cost.', disponíveis: '.$locked->{$pointsColumn}.')';
            }

            $locked->{$relation}()->attach($ability->id, ['level' => 1, 'type' => null]);
            $locked->{$pointsColumn} -= (int) $ability->purchase_cost;
            $locked->save();

            return null;
        });

        if ($error !== null) {
            return redirect()->to(route('characters.show', $character).'#'.$anchor)->withErrors(['ability_id' => $error]);
        }

        return redirect()->to(route('characters.show', $character).'#'.$anchor)->with('status', '"'.$ability->name.'" adicionado(a) à ficha!');
    }

    private function destroy(Character $character, Skill|Power $ability, string $relation, string $pointsColumn, string $anchor, string $label): RedirectResponse
    {
        Gate::authorize('editStats', $character);

        // Devolve o custo da versão da campanha, o mesmo cobrado ao adicionar.
        CampaignLibrary::for($character->gameSession)->overlay([$ability]);

        DB::transaction(static function () use ($character, $ability, $relation, $pointsColumn): void {
            $locked = Character::query()->lockForUpdate()->findOrFail($character->id);

            if ($locked->{$relation}()->detach($ability->id) > 0) {
                $locked->{$pointsColumn} += (int) $ability->purchase_cost;
                $locked->save();
            }
        });

        return redirect()->to(route('characters.show', $character).'#'.$anchor)->with('status', $label.' "'.$ability->name.'" removido(a); pontos devolvidos.');
    }
}
