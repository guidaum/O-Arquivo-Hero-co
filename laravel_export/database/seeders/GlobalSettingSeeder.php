<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class GlobalSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('global_settings')->delete();

        $records = [
            [
                'id' => 'config',
                'attributes' => '[{"label":"Força","id":"for","icon":"Sword","color":"text-ember"},{"id":"con","color":"text-ember","label":"Constituição","icon":"Shield"},{"icon":"Zap","label":"Agilidade","id":"agi","color":"text-arcane"},{"color":"text-gold","label":"Percepção","id":"per","icon":"Eye"},{"id":"vel","color":"text-arcane","label":"Velocidade","icon":"Zap"},{"color":"text-gold","icon":"Zap","id":"ini","label":"Iniciativa"},{"label":"Inteligência","icon":"Brain","color":"text-arcane","id":"int"},{"label":"Coragem","icon":"Heart","id":"cor","color":"text-ember"}]',
                'system_config' => null,
                'sounds' => null,
                'created_at' => '2026-11-03T10:25:53.071Z',
                'updated_at' => '2026-11-01T22:40:23.917Z'
            ],
            [
                'id' => 'menuFeatures',
                'attributes' => null,
                'system_config' => null,
                'sounds' => null,
                'created_at' => '2026-11-03T10:25:53.071Z',
                'updated_at' => '2026-11-03T10:25:53.071Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('global_settings')->insert($chunk);
        }
    }
}
