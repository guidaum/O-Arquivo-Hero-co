<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Atualiza users.last_active_at (o "lastActive" do sistema antigo),
 * no máximo uma vez a cada poucos minutos por usuário.
 */
class TrackLastActivity
{
    private const INTERVAL_MINUTES = 5;

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User
            && ($user->last_active_at === null || $user->last_active_at->lt(now()->subMinutes(self::INTERVAL_MINUTES)))
        ) {
            // Atualização direta: não altera updated_at nem dispara eventos.
            User::query()->whereKey($user->id)->update(['last_active_at' => now()]);
        }

        return $next($request);
    }
}
