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
     * Itens na ordem do sistema antigo: funcionalidade, rota, rótulo, rótulo
     * curto (barra inferior), ícone, grupo do menu, em que modo aparecem (null =
     * nos dois) e as rotas que marcam o item como atual.
     *
     * @var list<array{feature: string, route: string, label: string, short: string, icon: string, group: string, mode: ViewMode|null, admin?: bool, gm?: bool, active?: list<string>}>
     */
    private const ITEMS = [
        ['feature' => 'legends', 'route' => 'dashboard', 'label' => 'Minhas Lendas', 'short' => 'Lendas', 'icon' => 'layout-dashboard', 'group' => 'heroes', 'mode' => null, 'active' => ['dashboard', 'gm.sessions.*']],
        ['feature' => 'journal', 'route' => 'journal.index', 'label' => 'Diário de Sessão', 'short' => 'Diário', 'icon' => 'book-open', 'group' => 'table', 'mode' => null, 'active' => ['journal.*']],
        ['feature' => 'mapManager', 'route' => 'map-manager.index', 'label' => 'Gerenciador de Mapas', 'short' => 'Mapas', 'icon' => 'map', 'group' => 'gm', 'mode' => ViewMode::Gm, 'active' => ['map-manager.*']],
        ['feature' => 'dungeon', 'route' => 'dungeon.index', 'label' => 'Dungeons & Tokens', 'short' => 'Dungeon', 'icon' => 'skull', 'group' => 'table', 'mode' => null],
        ['feature' => 'worldMap', 'route' => 'world-map.index', 'label' => 'Mapa do Mundo', 'short' => 'Mundo', 'icon' => 'compass', 'group' => 'table', 'mode' => null],
        ['feature' => 'inventory', 'route' => 'inventory.index', 'label' => 'Inventário', 'short' => 'Inventário', 'icon' => 'backpack', 'group' => 'heroes', 'mode' => null, 'active' => ['inventory.*']],
        ['feature' => 'characterCreation', 'route' => 'characters.create', 'label' => 'Criação de Personagem', 'short' => 'Criar', 'icon' => 'user-plus', 'group' => 'heroes', 'mode' => null],
        ['feature' => 'characterSheet', 'route' => 'characters.sheet', 'label' => 'Ficha Geral', 'short' => 'Ficha', 'icon' => 'scroll-text', 'group' => 'heroes', 'mode' => null, 'active' => ['characters.s*']],
        ['feature' => 'catalogs', 'route' => 'catalog.talents.index', 'label' => 'Catálogos & Regras', 'short' => 'Catálogos', 'icon' => 'library', 'group' => 'gm', 'mode' => ViewMode::Gm, 'gm' => true, 'active' => ['catalog.*']],
        ['feature' => 'adminPanel', 'route' => 'admin.index', 'label' => 'Painel Admin', 'short' => 'Admin', 'icon' => 'shield', 'group' => 'gm', 'mode' => ViewMode::Gm, 'admin' => true, 'active' => ['admin.*']],
    ];

    /**
     * Grupos do menu lateral, na ordem em que aparecem: agrupar por contexto
     * (personagens, mesa de jogo, ferramentas do mestre) ajuda a achar cada tela.
     *
     * @var array<string, string>
     */
    private const GROUPS = [
        'heroes' => 'Personagens',
        'table' => 'Mesa de Jogo',
        'gm' => 'Ferramentas do Mestre',
    ];

    /**
     * Atalhos da barra inferior (celular e tablet) por modo de visão: as
     * telas mais usadas por quem joga e por quem mestra.
     *
     * @var array{user: list<string>, gm: list<string>}
     */
    private const SHORTCUTS = [
        'user' => ['legends', 'characterSheet', 'inventory', 'journal'],
        'gm' => ['legends', 'journal', 'dungeon', 'mapManager'],
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
     * @return list<array{feature: string, route: string, active: list<string>, label: string, short: string, icon: string, group: string}>
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

            $items[] = [
                'feature' => $item['feature'],
                'route' => $item['route'],
                'active' => $item['active'] ?? [$item['route']],
                'label' => $item['label'],
                'short' => $item['short'],
                'icon' => $item['icon'],
                'group' => $item['group'],
            ];
        }

        return $items;
    }

    /**
     * Itens do menu lateral agrupados; grupos sem itens liberados não aparecem.
     *
     * @return list<array{label: string, items: list<array{feature: string, route: string, active: list<string>, label: string, short: string, icon: string, group: string}>}>
     */
    public function groups(): array
    {
        $items = $this->items();
        $groups = [];

        foreach (self::GROUPS as $key => $label) {
            $members = array_values(array_filter($items, static fn (array $item): bool => $item['group'] === $key));

            if ($members !== []) {
                $groups[] = ['label' => $label, 'items' => $members];
            }
        }

        return $groups;
    }

    /**
     * Atalhos da barra inferior: as telas preferidas do modo de visão,
     * completadas pelos demais itens quando alguma estiver desativada. Se a
     * tela atual não estiver entre eles, ela ocupa o último lugar, para que a
     * barra sempre mostre onde a pessoa está.
     *
     * @param  callable(array{feature: string, route: string, active: list<string>, label: string, short: string, icon: string, group: string}): bool  $isActive
     * @return list<array{feature: string, route: string, active: list<string>, label: string, short: string, icon: string, group: string}>
     */
    public function shortcuts(callable $isActive, int $limit = 4): array
    {
        $items = $this->items();
        $byFeature = array_column($items, null, 'feature');
        $shortcuts = [];

        foreach (self::SHORTCUTS[$this->isGmView() ? 'gm' : 'user'] as $feature) {
            if (isset($byFeature[$feature])) {
                $shortcuts[$feature] = $byFeature[$feature];
            }
        }

        foreach ($items as $item) {
            $shortcuts[$item['feature']] ??= $item;
        }

        $shortcuts = array_slice(array_values($shortcuts), 0, $limit);

        if ($shortcuts === [] || array_filter($shortcuts, $isActive) !== []) {
            return $shortcuts;
        }

        foreach ($items as $item) {
            if ($isActive($item)) {
                $shortcuts[count($shortcuts) - 1] = $item;
                break;
            }
        }

        return $shortcuts;
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
