<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\GameSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Sessões de jogo do painel (SessionManager.tsx): o mestre cria a campanha
 * e os jogadores entram com o código dela.
 */
class GameSessionController extends Controller
{
    /** Sem 0/O e 1/I, para o código ser lido em voz alta sem confusão. */
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const CODE_LENGTH = 6;

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', GameSession::class);

        $data = $request->validateWithBag('createSession', [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
        ], [], ['name' => 'nome da campanha', 'description' => 'descrição']);

        $session = new GameSession([...$data, 'code' => $this->uniqueCode(), 'active' => true]);
        $session->gm_id = $request->user()->id;
        $session->save();

        return redirect()
            ->route('gm.sessions.show', $session)
            ->with('status', 'Campanha "'.$session->name.'" criada! Compartilhe o código '.$session->code.' com seus jogadores.');
    }

    public function join(Request $request): RedirectResponse
    {
        $data = $request->validateWithBag('joinSession', [
            'code' => ['required', 'string', 'max:32'],
        ], [], ['code' => 'código da sessão']);

        $user = $request->user();
        $session = GameSession::query()->where('code', mb_strtoupper(trim($data['code'])))->first();
        $error = match (true) {
            $session === null || ! $session->active => 'Código de sessão inválido.',
            $session->isGm($user) => 'Você é o mestre desta sessão.',
            $session->hasPlayer($user) => 'Você já participa desta campanha.',
            default => null,
        };

        if ($error !== null) {
            return back()->withErrors(['code' => $error], 'joinSession')->withInput();
        }

        Gate::authorize('join', $session);
        $session->players()->attach($user->id);

        return back()->with('status', 'Você entrou na campanha "'.$session->name.'"!');
    }

    private function uniqueCode(): string
    {
        do {
            $code = '';

            for ($i = 0; $i < self::CODE_LENGTH; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
        } while (GameSession::query()->where('code', $code)->exists());

        return $code;
    }
}
