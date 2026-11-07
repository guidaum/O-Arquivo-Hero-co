<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Support\Navigation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Acesso a um mapa dentro de uma campanha (mundo ou masmorra):
 * - participar da campanha (GameSessionPolicy::view);
 * - o mapa ser padrão ou da própria campanha;
 * - jogadores só veem mapas que o mestre deixou ativos.
 */
trait AuthorizesMapAccess
{
    /**
     * Confere o acesso e diz se o usuário age como mestre. Como no sistema
     * antigo, o mestre no modo Jogador vê o mapa como jogador.
     */
    protected function authorizeMap(Request $request, GameSession $session, CampaignMap $map): bool
    {
        Gate::authorize('view', $session);

        abort_unless($map->isPreset() || $map->game_session_id === $session->id, 404);

        $isGm = $request->user()->can('update', $session) && Navigation::for($request)->isGmView();

        if (! $isGm) {
            $setting = $session->maps()->whereKey($map->id)->first()?->pivot;
            abort_unless($setting !== null ? (bool) $setting->active : $map->active, 403, 'Este mapa não está ativo na campanha.');
        }

        return $isGm;
    }

    /**
     * Mesmo acesso, exigindo um mapa de masmorra (battlemap).
     */
    protected function authorizeDungeon(Request $request, GameSession $session, CampaignMap $map): bool
    {
        abort_unless($map->type === \App\Enums\MapType::Dungeon, 404);

        return $this->authorizeMap($request, $session, $map);
    }
}
