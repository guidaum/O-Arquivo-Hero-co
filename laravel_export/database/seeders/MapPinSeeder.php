<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MapPinSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('map_pins')->delete();

        $records = [
            [
                'id' => '3H7qgE4RO7aBPWL2bwWK',
                'map_id' => '9o34aWz18sn51Ym35suN',
                'title' => 'Teste',
                'description' => null,
                'x' => 17.21,
                'y' => 59.4,
                'type' => null,
                'custom_map_url' => 'https://cdn2.inkarnate.com/AArHVGQhiyydNCuFbAkpHa',
                'created_by' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'created_at' => '2026-10-14T10:21:40.428Z',
                'updated_at' => '2026-11-03T10:25:53.047Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('map_pins')->insert($chunk);
        }
    }
}
