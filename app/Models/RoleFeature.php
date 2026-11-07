<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Funcionalidade do menu liberada ou não para um papel.
 */
#[Fillable(['role', 'feature', 'enabled'])]
class RoleFeature extends Model
{
    /**
     * Funcionalidades do menu (MENU_FEATURE_DEFINITIONS do sistema antigo).
     *
     * @var array<string, array{label: string, path: string, description: string, category: string}>
     */
    public const DEFINITIONS = [
        'legends' => ['label' => 'Minhas Lendas', 'path' => '/', 'description' => 'Painel principal de personagens e campanhas.', 'category' => 'Principal'],
        'journal' => ['label' => 'Diário de Sessão', 'path' => '/diario', 'description' => 'Anotações, histórico e registros das sessões de jogo.', 'category' => 'Sessão'],
        'mapManager' => ['label' => 'Gerenciador de Mapas', 'path' => '/mapas', 'description' => 'Envio e gerenciamento de mapas táticos da campanha.', 'category' => 'Mestre'],
        'dungeon' => ['label' => 'Dungeons & Tokens', 'path' => '/dungeon', 'description' => 'Grid tático com névoa de guerra e posicionamento de tokens.', 'category' => 'Sessão'],
        'worldMap' => ['label' => 'Mapa do Mundo', 'path' => '/mapa', 'description' => 'Visualização cartográfica do universo da campanha.', 'category' => 'Sessão'],
        'inventory' => ['label' => 'Inventário & Itens', 'path' => '/inventario', 'description' => 'Gestão de equipamentos, itens mágicos e tesouros.', 'category' => 'Principal'],
        'characterCreation' => ['label' => 'Criação de Personagem', 'path' => '/personagens/criar', 'description' => 'Passo a passo guiado para forjar novos heróis.', 'category' => 'Principal'],
        'characterSheet' => ['label' => 'Ficha Geral', 'path' => '/ficha', 'description' => 'Visualização e rolagem de atributos, talentos e perícias.', 'category' => 'Principal'],
        'adminPanel' => ['label' => 'Painel Admin', 'path' => '/admin', 'description' => 'Gerenciamento global de usuários, campanhas e recursos do sistema.', 'category' => 'Principal'],
    ];

    /**
     * Funcionalidades bloqueadas por padrão (DEFAULT_ROLE_PERMISSIONS do
     * sistema antigo). As demais ficam liberadas quando não há registro.
     */
    private const DISABLED_BY_DEFAULT = [
        'gm.adminPanel',
        'user.mapManager',
        'user.adminPanel',
    ];

    /**
     * A tabela é lida uma única vez por requisição.
     */
    public static function isEnabled(UserRole $role, string $feature): bool
    {
        $flags = once(static fn (): array => self::query()
            ->get(['role', 'feature', 'enabled'])
            ->mapWithKeys(static fn (self $flag): array => [$flag->role->value.'.'.$flag->feature => $flag->enabled])
            ->all());

        $key = $role->value.'.'.$feature;

        return $flags[$key] ?? self::enabledByDefault($role, $feature);
    }

    public static function enabledByDefault(UserRole $role, string $feature): bool
    {
        return ! in_array($role->value.'.'.$feature, self::DISABLED_BY_DEFAULT, true);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'enabled' => 'boolean',
        ];
    }
}
