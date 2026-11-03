<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorldMapSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('world_maps')->delete();

        $records = [
            [
                'id' => '9o34aWz18sn51Ym35suN',
                'name' => 'Teste',
                'subtitle' => 'Mapa do mundo personalizado',
                'image_url' => 'https://cdn2.inkarnate.com/AArHVGQhiyydNCuFbAkpHa',
                'default_scale' => '1 cm = 25 léguas',
                'active' => true,
                'session_id' => 'Vceq7qnas0cVnPooYvRc',
                'created_by' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'layer_settings' => null,
                'created_at' => '2026-10-14T10:05:35.992Z',
                'updated_at' => '2026-11-03T10:25:53.045Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('world_maps')->insert($chunk);
        }
    }
}
