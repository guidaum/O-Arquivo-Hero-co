<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Aba "Usuários": busca, filtro por papel, troca de papel e exclusão.
 */
class UserController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->query('busca'));
        $role = UserRole::tryFrom((string) $request->query('papel'));

        $users = User::query()
            ->when($search !== '', static function ($query) use ($search): void {
                $query->where(static function ($query) use ($search): void {
                    $query->where('name', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%');
                });
            })
            ->when($role !== null, static fn ($query) => $query->where('role', $role))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('admin.users', [
            'users' => $users,
            'search' => $search,
            'role' => $role,
        ]);
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::enum(UserRole::class)],
        ]);

        // Evita que o administrador perca o próprio acesso ao painel.
        if ($user->is($request->user())) {
            return back()->withErrors(['role' => 'Você não pode alterar o seu próprio papel.']);
        }

        $user->forceFill(['role' => UserRole::from($data['role'])])->save();

        return back()->with('status', 'Papel de '.$user->name.' atualizado para '.$user->role->label().'.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->is($request->user())) {
            return back()->withErrors(['user' => 'Você não pode excluir a sua própria conta pelo painel.']);
        }

        $user->delete();

        return back()->with('status', 'Usuário "'.$user->name.'" excluído com sucesso.');
    }
}
