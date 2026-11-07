<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CustomSound;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Support\Sounds;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Sons da campanha (aba "Sons" do painel do mestre, SoundEffectManager.tsx):
 * o som de cada efeito nas regras da campanha (ou também nas globais, para
 * administradores) e a biblioteca de áudios enviados pelo mestre.
 */
class SoundBoardController extends Controller
{
    public function update(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);
        $user = $request->user();

        $libraryIds = CustomSound::query()->availableTo($user, $gameSession)->pluck('id')->all();
        $valueRule = static function (string $attribute, mixed $value, \Closure $fail) use ($libraryIds): void {
            if ($value === null || $value === '' || (is_string($value) && str_starts_with($value, 'synth:'))) {
                return;
            }
            if (! is_string($value) || strlen($value) > 255) {
                $fail('Escolha um som válido.');
            } elseif (preg_match('/^sound:(\d+)$/', $value, $match) === 1) {
                if (! in_array((int) $match[1], $libraryIds, true)) {
                    $fail('O som escolhido não está na sua biblioteca.');
                }
            } elseif (filter_var($value, FILTER_VALIDATE_URL) === false || preg_match('#^https?://#i', $value) !== 1) {
                $fail('Informe um endereço http(s) válido.');
            }
        };

        // No formulário, "url" na lista quer dizer: use o endereço digitado ao lado.
        $sounds = (array) $request->input('sounds', []);
        foreach ($sounds as $key => $choice) {
            if ($choice === 'url') {
                $sounds[$key] = trim((string) $request->input('sound_urls.'.$key, ''));
            }
        }
        $request->merge(['sounds' => $sounds]);

        $rules = ['also_global' => ['boolean'], 'sounds' => ['array'], 'sounds.custom_ambient' => ['nullable', $valueRule]];
        foreach (array_keys(Sounds::EFFECTS) as $key) {
            $rules['sounds.'.$key] = ['nullable', $valueRule];
        }

        $data = $request->validateWithBag('sounds', $rules);
        $values = array_map(
            static fn (mixed $value): ?string => is_string($value) && $value !== '' && ! str_starts_with($value, 'synth:') ? $value : null,
            (array) ($data['sounds'] ?? []),
        );

        $alsoGlobal = $request->boolean('also_global') && $user->can('access-admin');

        DB::transaction(static function () use ($gameSession, $values, $alsoGlobal): void {
            $campaign = $gameSession->ruleSet ?? (RuleSet::query()->global()->first()?->replicate(['game_session_id']) ?? new RuleSet);
            $campaign->game_session_id = $gameSession->id;
            self::apply($campaign, $values);

            if ($alsoGlobal) {
                $global = RuleSet::query()->global()->first() ?? new RuleSet;
                self::apply($global, $values);
            }
        });

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'sons'])
            ->with('status', $alsoGlobal ? 'Sons salvos na campanha e no padrão global!' : 'Sons da campanha salvos!');
    }

    /**
     * Envia um arquivo (MP3, WAV, OGG...) ou cadastra um endereço na biblioteca.
     */
    public function storeSound(Request $request, GameSession $gameSession): RedirectResponse
    {
        Gate::authorize('update', $gameSession);

        $data = $request->validateWithBag('library', [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(array_keys(Sounds::CATEGORIES))],
            'scope' => ['required', Rule::in(['campaign', 'personal'])],
            'file' => ['required_without:url', 'nullable', 'file', 'mimes:'.Sounds::UPLOAD_MIMES, 'max:'.Sounds::UPLOAD_MAX_KB],
            'url' => ['required_without:file', 'nullable', 'url:http,https', 'max:2048'],
        ], [
            'file.required_without' => 'Envie um arquivo de áudio ou informe um endereço.',
            'url.required_without' => 'Envie um arquivo de áudio ou informe um endereço.',
            'file.mimes' => 'Envie um áudio MP3, WAV, OGG, M4A ou WEBM.',
            'file.max' => 'O áudio pode ter no máximo 10 MB.',
        ], ['name' => 'nome', 'category' => 'categoria', 'file' => 'arquivo', 'url' => 'endereço']);

        $sound = new CustomSound([
            'name' => $data['name'],
            'category' => $data['category'],
            'type' => $data['category'] === 'ambient' ? 'ambient' : 'sfx',
        ]);
        $sound->game_session_id = $data['scope'] === 'campaign' ? $gameSession->id : null;
        $sound->user_id = $request->user()->id;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $sound->source_type = 'upload';
            $sound->path = $file->store('sounds', 'public');
            $sound->size = $file->getSize();
            $sound->format = strtoupper($file->getClientOriginalExtension() ?: (string) $file->extension());
        } else {
            $sound->source_type = 'url';
            $sound->path = $data['url'];
            $sound->format = strtoupper(pathinfo((string) parse_url($data['url'], PHP_URL_PATH), PATHINFO_EXTENSION)) ?: null;
        }

        $sound->save();

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'sons'])
            ->with('status', 'Som "'.$sound->name.'" adicionado à biblioteca.');
    }

    /**
     * Remove um som da biblioteca (autor ou mestre da campanha do som). Os
     * efeitos que o usavam voltam ao som sintetizado.
     */
    public function destroySound(Request $request, GameSession $gameSession, CustomSound $customSound): RedirectResponse
    {
        Gate::authorize('update', $gameSession);
        $user = $request->user();

        $mine = $customSound->user_id === $user->id;
        $ofThisCampaign = $customSound->game_session_id === $gameSession->id;
        abort_unless($ofThisCampaign || ($mine && $customSound->game_session_id === null) || $user->can('access-admin'), 404);

        if ($customSound->source_type === 'upload' && $customSound->path !== '' && ! str_starts_with($customSound->path, 'http')) {
            Storage::disk('public')->delete($customSound->path);
        }

        $customSound->delete();

        return redirect()->route('gm.sessions.show', [$gameSession, 'aba' => 'sons'])
            ->with('status', 'Som "'.$customSound->name.'" removido da biblioteca.');
    }

    /**
     * @param  array<string, string|null>  $values
     */
    private static function apply(RuleSet $ruleSet, array $values): void
    {
        $extra = (array) ($ruleSet->sound_settings ?? []);

        foreach (Sounds::EFFECTS as $key => [, , , $column]) {
            if (! array_key_exists($key, $values)) {
                continue;
            }

            if ($column !== null) {
                $ruleSet->setAttribute($column, $values[$key]);
            } else {
                $extra[$key] = $values[$key];
            }
        }

        if (array_key_exists('custom_ambient', $values)) {
            $extra['custom_ambient'] = $values['custom_ambient'];
        }

        $ruleSet->sound_settings = array_filter($extra, static fn (?string $value): bool => $value !== null);
        $ruleSet->save();
    }
}
