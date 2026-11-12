<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\SuggestionStatus;
use App\Http\Controllers\Controller;
use App\Models\Suggestion;
use App\Support\CampaignLibrary;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/**
 * Sugestões para as Configurações Base, revisadas pelo administrador:
 * - das campanhas: o que os mestres criaram ou alteraram na biblioteca da
 *   campanha. Levar para a base faz as outras campanhas receberem como
 *   sugestão; ignorar só tira da lista;
 * - dos jogadores: enviadas na criação de personagem. Aprovar abre o
 *   formulário do catálogo preenchido (Catalog\SuggestionController).
 */
class SuggestionController extends Controller
{
    public const ORIGINS = ['campanhas' => 'Das campanhas', 'jogadores' => 'Dos jogadores'];

    public function index(Request $request): View
    {
        $origin = array_key_exists((string) $request->query('origem'), self::ORIGINS) ? (string) $request->query('origem') : 'campanhas';
        $status = SuggestionStatus::tryFrom((string) $request->query('status')) ?? SuggestionStatus::Pending;
        $proposals = CampaignLibrary::proposals();

        return view('admin.suggestions', [
            'origin' => $origin,
            'status' => $status,
            'proposals' => $origin === 'campanhas' ? CampaignLibrary::paginate($proposals, $request) : null,
            'suggestions' => $origin === 'jogadores'
                ? Suggestion::query()->with('user:id,name')->where('status', $status)->latest()->paginate(20)->withQueryString()
                : null,
            'counts' => [
                'campanhas' => $proposals->count(),
                'jogadores' => Suggestion::query()->where('status', SuggestionStatus::Pending)->count(),
            ],
        ]);
    }

    /**
     * Leva a criação ou alteração da campanha para a base.
     */
    public function promote(string $type, string $entry): RedirectResponse
    {
        $row = $this->proposal($type, $entry);
        $name = (string) $row->getAttribute('name');

        $error = DB::transaction(static fn (): ?string => CampaignLibrary::promote($row));

        if ($error !== null) {
            return back()->withErrors(['proposal' => $error]);
        }

        return back()->with('status', '"'.$name.'" agora faz parte das Configurações Base. As outras campanhas recebem a mudança como sugestão.');
    }

    /**
     * Ignora a proposta: a campanha continua com a sua versão.
     */
    public function dismiss(string $type, string $entry): RedirectResponse
    {
        $row = $this->proposal($type, $entry);
        $row->setAttribute('proposed_at', null);
        $row->save();

        return back()->with('status', 'Sugestão de "'.$row->getAttribute('name').'" ignorada; a campanha continua com a sua versão.');
    }

    private function proposal(string $type, string $entry): \Illuminate\Database\Eloquent\Model
    {
        $model = CampaignLibrary::modelOf($type) ?? abort(404);

        return $model::query()
            ->whereNotNull('game_session_id')
            ->whereNotNull('proposed_at')
            ->findOrFail($entry);
    }
}
