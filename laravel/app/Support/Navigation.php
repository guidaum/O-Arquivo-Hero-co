<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\UserRole;
use App\Enums\ViewMode;
use App\Models\RoleFeature;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Menu principal e modo de visão (Mestre/Jogador), com as mesmas regras
 * do Layout.tsx do sistema antigo:
 * - quem é mestre, admin ou mestra alguma campanha pode alternar o modo;
 * - no modo Jogador aparecem só os menus de jogador, mesmo para mestres;
 * - cada item respeita as funcionalidades liberadas para o perfil efetivo.
 */
final class Navigation
{
    public const SESSION_KEY = 'view_mode';

    /**
     * Itens na ordem do sistema antigo: funcionalidade, rota, rótulo, ícone
     * e em que modo aparecem (null = nos dois).
     *
     * @var list<array{feature: string, route: string, label: string, icon: string, mode: ViewMode|null, admin?: bool, gm?: bool, active?: string}>
     */
    private const ITEMS = [
        ['feature' => 'legends', 'route' => 'dashboard', 'label' => 'Minhas Lendas', 'icon' => 'layout-dashboard', 'mode' => null],
        ['feature' => 'journal', 'route' => 'journal.index', 'label' => 'Diário de Sessão', 'icon' => 'book-open', 'mode' => null, 'active' => 'journal.*'],
        ['feature' => 'mapManager', 'route' => 'map-manager.index', 'label' => 'Gerenciador de Mapas', 'icon' => 'map', 'mode' => ViewMode::Gm],
        ['feature' => 'dungeon', 'route' => 'dungeon.index', 'label' => 'Dungeons & Tokens', 'icon' => 'skull', 'mode' => null],
        ['feature' => 'worldMap', 'route' => 'world-map.index', 'label' => 'Mapa do Mundo', 'icon' => 'compass', 'mode' => null],
        ['feature' => 'inventory', 'route' => 'inventory.index', 'label' => 'Inventário', 'icon' => 'backpack', 'mode' => null, 'active' => 'inventory.*'],
        ['feature' => 'characterCreation', 'route' => 'characters.create', 'label' => 'Criação de Personagem', 'icon' => 'user-plus', 'mode' => null],
        ['feature' => 'characterSheet', 'route' => 'characters.sheet', 'label' => 'Ficha Geral', 'icon' => 'scroll-text', 'mode' => null, 'active' => 'characters.s*'],
        ['feature' => 'catalogs', 'route' => 'catalog.talents.index', 'label' => 'Catálogos & Regras', 'icon' => 'library', 'mode' => ViewMode::Gm, 'gm' => true, 'active' => 'catalog.*'],
        ['feature' => 'adminPanel', 'route' => 'admin.index', 'label' => 'Painel Admin', 'icon' => 'shield', 'mode' => ViewMode::Gm, 'admin' => true, 'active' => 'admin.*'],
    ];

    private ?bool $mastersSessions = null;

    public function __construct(
        private readonly User $user,
        private readonly ViewMode $viewMode,
    ) {
    }

    /**
     * Modo salvo na sessão ou, na primeira visita, o que combina com o papel.
     */
    public static function for(Request $request): self
    {
        /** @var User $user */
        $user = $request->user();
        $stored = ViewMode::tryFrom((string) $request->session()->get(self::SESSION_KEY));

        return new self($user, $stored ?? ($user->isGm() ? ViewMode::Gm : ViewMode::Player));
    }

    public function user(): User
    {
        return $this->user;
    }

    public function viewMode(): ViewMode
    {
        return $this->viewMode;
    }

    /**
     * Pode usar a interface do Mestre: papel de mestre/admin ou mestre de alguma campanha.
     */
    public function canBeGm(): bool
    {
        if ($this->user->isGm()) {
            return true;
        }

        return $this->mastersSessions ??= $this->user->gmSessions()->exists();
    }

    public function isGmView(): bool
    {
        return $this->viewMode === ViewMode::Gm && $this->canBeGm();
    }

    /**
     * Perfil usado para decidir os menus: admin só no modo Mestre.
     */
    public function effectiveRole(): UserRole
    {
        if (! $this->isGmView()) {
            return UserRole::User;
        }

        return $this->user->isAdmin() ? UserRole::Admin : UserRole::Gm;
    }

    /**
     * @return list<array{route: string, active: string, label: string, icon: string}>
     */
    public function items(): array
    {
        $role = $this->effectiveRole();
        $items = [];

        foreach (self::ITEMS as $item) {
            if ($item['mode'] === ViewMode::Gm && ! $this->isGmView()) {
                continue;
            }

            if (($item['admin'] ?? false) && ! $this->user->isAdmin()) {
                continue;
            }

            // Ferramentas de catálogo exigem o papel de mestre (não basta mestrar uma campanha).
            if (($item['gm'] ?? false) && ! $this->user->isGm()) {
                continue;
            }

            if (! RoleFeature::isEnabled($role, $item['feature'])) {
                continue;
            }

            $items[] = ['route' => $item['route'], 'active' => $item['active'] ?? $item['route'], 'label' => $item['label'], 'icon' => $item['icon']];
        }

        return $items;
    }

    /**
     * "Nível" exibido no cabeçalho: campanhas mestradas (mestres) ou jogadas.
     */
    public function level(): int
    {
        return $this->user->role === UserRole::Gm
            ? $this->user->gmSessions()->count()
            : $this->user->playerSessions()->count();
    }
}
