<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restringe a rota a papéis. Uso: ->middleware('role:gm').
 * Administradores sempre passam; "gm" também aceita administradores.
 */
class EnsureUserHasRole
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            abort(Response::HTTP_UNAUTHORIZED);
        }

        $allowed = $user->isAdmin()
            || in_array($user->role->value, $roles, true)
            || (in_array('gm', $roles, true) && $user->isGm());

        abort_unless($allowed, Response::HTTP_FORBIDDEN, 'Você não tem permissão para acessar esta página.');

        return $next($request);
    }
}
