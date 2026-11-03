<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DungeonMapSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('dungeon_maps')->delete();

        $records = [

        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('dungeon_maps')->insert($chunk);
        }
    }
}
