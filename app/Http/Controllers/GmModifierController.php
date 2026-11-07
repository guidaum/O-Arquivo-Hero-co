<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Game\GameRules;
use App\Models\Character;
use App\Models\Talent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Modificadores do mestre em atributos e talentos, sempre com justificativa.
 * Só o mestre da campanha (ou admin) lança e remove.
 */
class GmModifierController extends Controller
{
    public function store(Request $request, Character $character): RedirectResponse
    {
        Gate::authorize('unlockStats', $character);

        $targets = [
            ...array_map(static fn (array $attribute): string => strtolower($attribute['id']), GameRules::forSession($character->gameSession)->attributes()),
            ...Talent::query()->pluck('id')->map(static fn (int $id): string => 'talent:'.$id)->all(),
        ];

        $data = $request->validate([
            'target' => ['required', 'string', Rule::in($targets)],
            'value' => ['required', 'integer', 'min:-100', 'max:100', 'not_in:0'],
            'justification' => ['required', 'string', 'max:500'],
        ], [
            'justification.required' => 'A justificativa do mestre é obrigatória!',
            'value.not_in' => 'O modificador não pode ser zero.',
        ], ['target' => 'alvo', 'value' => 'valor', 'justification' => 'justificativa']);

        $user = $request->user();

        DB::transaction(static function () use ($character, $data, $user): void {
            $locked = Character::query()->lockForUpdate()->findOrFail($character->id);
            $modifiers = (array) ($locked->gm_modifiers ?? []);
            $modifiers[$data['target']][] = [
                'id' => (string) Str::uuid(),
                'value' => (int) $data['value'],
                'justification' => trim($data['justification']),
                'author_id' => $user->id,
                'author_name' => $user->name,
                'created_at' => now()->toIso8601String(),
            ];
            $locked->gm_modifiers = $modifiers;
            $locked->save();
        });

        return redirect()->to(route('characters.show', $character).'#'.(str_starts_with($data['target'], 'talent:') ? 'talentos' : 'atributos'))
            ->with('status', 'Modificador do mestre salvo com sucesso!');
    }

    public function destroy(Character $character, string $modifier): RedirectResponse
    {
        Gate::authorize('unlockStats', $character);

        $removed = DB::transaction(static function () use ($character, $modifier): bool {
            $locked = Character::query()->lockForUpdate()->findOrFail($character->id);
            $modifiers = (array) ($locked->gm_modifiers ?? []);
            $removed = false;

            foreach ($modifiers as $target => $entries) {
                $kept = array_values(array_filter((array) $entries, static fn (mixed $entry): bool => ! (is_array($entry) && ($entry['id'] ?? null) === $modifier)));
                $removed = $removed || count($kept) !== count((array) $entries);

                if ($kept === []) {
                    unset($modifiers[$target]);
                } else {
                    $modifiers[$target] = $kept;
                }
            }

            $locked->gm_modifiers = $modifiers === [] ? null : $modifiers;
            $locked->save();

            return $removed;
        });

        abort_unless($removed, 404);

        return back()->with('status', 'Modificador do mestre removido.');
    }
}
