<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            GameSessionSeeder::class,
            CharacterSeeder::class,
            JournalEntrySeeder::class,
            TalentSeeder::class,
            SkillSeeder::class,
            PowerSeeder::class,
            TraitSeeder::class,
            ItemCatalogSeeder::class,
            WorldMapSeeder::class,
            DungeonMapSeeder::class,
            DungeonTokenSeeder::class,
            DungeonFogSeeder::class,
            MapPinSeeder::class,
            ChatMessageSeeder::class,
            SuggestionSeeder::class,
            GlobalSettingSeeder::class,
        ]);
    }
}
