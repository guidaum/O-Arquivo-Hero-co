<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GameSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Aba "Sessões": busca e exclusão de qualquer campanha.
 */
class GameSessionController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));

        $sessions = GameSession::query()
            ->with('gm:id,name')
            ->withCount(['players', 'characters'])
            ->when($search !== '', static function ($query) use ($search): void {
                $query->where(static function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('code', 'like', '%'.$search.'%');
                });
            })
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('admin.sessions', [
            'sessions' => $sessions,
            'search' => $search,
        ]);
    }

    public function destroy(GameSession $gameSession): RedirectResponse
    {
        $gameSession->delete();

        return back()->with('status', 'Campanha "'.$gameSession->name.'" excluída com sucesso.');
    }
}
