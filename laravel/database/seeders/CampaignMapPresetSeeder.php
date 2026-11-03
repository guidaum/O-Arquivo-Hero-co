<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\MapType;
use App\Models\CampaignMap;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Mapas padrão do sistema, disponíveis para todas as campanhas.
 * As imagens ficam em resources/images/maps e são copiadas para o disco público.
 */
class CampaignMapPresetSeeder extends Seeder
{
    /**
     * @var list<array<string, mixed>>
     */
    private const PRESETS = [
        [
            'preset_key' => 'aethelgard',
            'type' => MapType::World,
            'name' => 'Continente de Aethelgard',
            'subtitle' => 'Reinos Antigos, Florestas Místicas & Picos Gelados',
            'default_scale' => '1 cm = 50 milhas',
        ],
        [
            'preset_key' => 'archipelago',
            'type' => MapType::World,
            'name' => 'As Ilhas Despedaçadas',
            'subtitle' => 'Arquipélago Pirata, Recifes Mortais & Mares Bravios',
            'default_scale' => '1 cm = 30 léguas',
        ],
        [
            'preset_key' => 'catacombs',
            'type' => MapType::Dungeon,
            'name' => 'Catacumbas Antigas de Khardoos',
            'subtitle' => 'Cripta subterrânea ancestral com câmaras secretas, sarcófagos e corredores estreitos',
            'theme' => 'Subterrâneo & Cripta',
            'grid_cols' => 24,
            'grid_rows' => 14,
            'entrance_x' => 8.5,
            'entrance_y' => 35.0,
        ],
        [
            'preset_key' => 'temple',
            'type' => MapType::Dungeon,
            'name' => 'Templo Subterrâneo Arcano',
            'subtitle' => 'Ruínas místicas com círculos rúnicos brilhantes, cristais e piscinas de mana',
            'theme' => 'Místico & Arcano',
            'grid_cols' => 24,
            'grid_rows' => 14,
            'entrance_x' => 50.0,
            'entrance_y' => 88.0,
        ],
        [
            'preset_key' => 'cavern',
            'type' => MapType::Dungeon,
            'name' => 'Covil Vulcânico do Dragão',
            'subtitle' => 'Caverna natural com rios de magma fervente, pontes de pedra e pilhas de tesouro',
            'theme' => 'Ígneo & Letal',
            'grid_cols' => 24,
            'grid_rows' => 14,
            'entrance_x' => 10.0,
            'entrance_y' => 80.0,
        ],
    ];

    public function run(): void
    {
        $disk = Storage::disk('public');

        foreach (self::PRESETS as $preset) {
            $source = resource_path('images/maps/'.$preset['preset_key'].'.jpg');
            $path = 'maps/presets/'.$preset['preset_key'].'.jpg';

            if (! $disk->exists($path) && is_file($source)) {
                $disk->put($path, (string) file_get_contents($source));
            }

            CampaignMap::query()
                ->firstOrNew(['preset_key' => $preset['preset_key']])
                ->forceFill([...$preset, 'image_path' => $path, 'active' => true])
                ->save();
        }

        $this->command?->info(sprintf('Mapas padrão: %d', count(self::PRESETS)));
    }
}
