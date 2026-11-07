<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Character;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Aba "Personagens": busca e exclusão de qualquer personagem.
 */
class CharacterController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));

        $characters = Character::query()
            ->with(['user:id,name', 'gameSession:id,name'])
            ->when($search !== '', static function ($query) use ($search): void {
                $query->where(static function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('class', 'like', '%'.$search.'%');
                });
            })
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('admin.characters', [
            'characters' => $characters,
            'search' => $search,
        ]);
    }

    public function destroy(Character $character): RedirectResponse
    {
        $character->deleteWithFiles();

        return back()->with('status', 'Personagem "'.$character->name.'" excluído com sucesso.');
    }
}
