<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Conteúdo de jogo compartilhado: talentos, perícias, poderes, traços e
 * itens do catálogo. Todos leem; mestres criam, editam e excluem.
 * Registrada para cada Model em AppServiceProvider.
 */
class GameContentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Model $content): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isGm();
    }

    public function update(User $user, Model $content): bool
    {
        return $user->isGm();
    }

    public function delete(User $user, Model $content): bool
    {
        return $user->isGm();
    }
}
