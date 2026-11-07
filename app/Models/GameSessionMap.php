<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Configuração de um mapa dentro de uma campanha (mapSettings no Firebase):
 * ativo para os jogadores e camadas visuais. A névoa de guerra (células
 * reveladas) fica em dungeon_fogs, fonte única também para a masmorra.
 */
class GameSessionMap extends Pivot
{
    protected $table = 'game_session_maps';

    /** Camadas padrão (DEFAULT_LAYER_SETTINGS em campaignMaps.ts). */
    public const DEFAULT_LAYERS = [
        'show_background' => true,
        'background_opacity' => 100,
        'show_grid' => true,
        'grid_opacity' => 75,
        'show_tokens' => true,
        'fog_opacity' => 90,
        'grid_scale' => ['unit' => 'ft', 'value_per_square' => 5],
    ];

    /** Unidades da régua: chave => [rótulo curto, descrição]. "sq" antigo = "squares". */
    public const SCALE_UNITS = [
        'ft' => ['pés', 'Pés (ft) – padrão D&D 5e'],
        'm' => ['metros', 'Metros (m) – sistema métrico'],
        'squares' => ['blocos', 'Quadrados / blocos'],
        'km' => ['km', 'Quilômetros (km) – mapa regional'],
        'mi' => ['milhas', 'Milhas (mi) – mapa continental'],
        'leagues' => ['léguas', 'Léguas – náutico / fantasia'],
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'layer_settings' => 'array',
        ];
    }

    /**
     * Camadas completas, aceitando o formato importado (camelCase) e o atual.
     *
     * @param  array<string, mixed>|null  $settings
     * @return array<string, mixed>
     */
    public static function normalizeLayers(?array $settings): array
    {
        $settings ??= [];
        $read = static fn (string $snake, string $camel, mixed $default): mixed => $settings[$snake] ?? $settings[$camel] ?? $default;
        $percent = static fn (mixed $value, int $default): int => is_numeric($value) ? max(0, min(100, (int) round((float) $value))) : $default;

        $scale = $read('grid_scale', 'gridScale', []);
        $scale = is_array($scale) ? $scale : [];
        $unit = (string) ($scale['unit'] ?? 'ft');
        $unit = $unit === 'sq' ? 'squares' : $unit;
        $perSquare = $scale['value_per_square'] ?? $scale['valuePerSquare'] ?? 5;

        return [
            'show_background' => (bool) $read('show_background', 'showBackground', true),
            'background_opacity' => $percent($read('background_opacity', 'backgroundOpacity', 100), 100),
            'show_grid' => (bool) $read('show_grid', 'showGrid', true),
            'grid_opacity' => $percent($read('grid_opacity', 'gridOpacity', 75), 75),
            'show_tokens' => (bool) $read('show_tokens', 'showTokens', true),
            'fog_opacity' => $percent($read('fog_opacity', 'fogOpacity', 90), 90),
            'grid_scale' => [
                'unit' => array_key_exists($unit, self::SCALE_UNITS) ? $unit : 'ft',
                'value_per_square' => is_numeric($perSquare) ? max(0.1, round((float) $perSquare, 2)) : 5,
            ],
        ];
    }
}
