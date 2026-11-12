<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\GameSessionMap;
use PHPUnit\Framework\TestCase;

/**
 * Camadas de um mapa na campanha (GameSessionMap::normalizeLayers): aceita o
 * formato importado do Firebase (camelCase) e o atual, sempre completo.
 */
class LayerSettingsTest extends TestCase
{
    public function test_empty_settings_get_the_defaults(): void
    {
        $this->assertSame([
            'show_background' => true,
            'background_opacity' => 100,
            'show_grid' => true,
            'grid_opacity' => 75,
            'show_tokens' => true,
            'fog_opacity' => 90,
            'grid_scale' => ['unit' => 'ft', 'value_per_square' => 5.0],
        ], GameSessionMap::normalizeLayers(null));
    }

    public function test_imported_camel_case_is_understood(): void
    {
        $layers = GameSessionMap::normalizeLayers([
            'showGrid' => false,
            'gridOpacity' => 40,
            'gridScale' => ['unit' => 'sq', 'valuePerSquare' => '1.5'],
        ]);

        $this->assertFalse($layers['show_grid']);
        $this->assertSame(40, $layers['grid_opacity']);
        $this->assertSame(['unit' => 'squares', 'value_per_square' => 1.5], $layers['grid_scale']);
    }

    public function test_current_format_wins_over_imported(): void
    {
        $layers = GameSessionMap::normalizeLayers(['fog_opacity' => 30, 'fogOpacity' => 80]);

        $this->assertSame(30, $layers['fog_opacity']);
    }

    public function test_invalid_values_are_clamped_or_replaced(): void
    {
        $layers = GameSessionMap::normalizeLayers([
            'background_opacity' => 250,
            'grid_opacity' => -10,
            'fog_opacity' => 'muito',
            'grid_scale' => ['unit' => 'parsecs', 'value_per_square' => 0],
        ]);

        $this->assertSame(100, $layers['background_opacity']);
        $this->assertSame(0, $layers['grid_opacity']);
        $this->assertSame(90, $layers['fog_opacity']);
        $this->assertSame(['unit' => 'ft', 'value_per_square' => 0.1], $layers['grid_scale']);
    }
}
