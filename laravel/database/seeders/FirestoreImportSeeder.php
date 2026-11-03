<?php

declare(strict_types=1);

namespace Database\Seeders;

use Database\Seeders\Firestore\CampaignMapSeeder;
use Database\Seeders\Firestore\CatalogItemSeeder;
use Database\Seeders\Firestore\CharacterSeeder;
use Database\Seeders\Firestore\ChatMessageSeeder;
use Database\Seeders\Firestore\DungeonStateSeeder;
use Database\Seeders\Firestore\FirestoreDump;
use Database\Seeders\Firestore\GameCatalogSeeder;
use Database\Seeders\Firestore\GameSessionSeeder;
use Database\Seeders\Firestore\JournalEntrySeeder;
use Database\Seeders\Firestore\MapAnnotationSeeder;
use Database\Seeders\Firestore\RuleSetSeeder;
use Database\Seeders\Firestore\SuggestionSeeder;
use Database\Seeders\Firestore\UserSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Importa os dados exportados do Firebase (config arquivo.import.dump_path).
 *
 * Pode ser executado mais de uma vez: os registros são localizados pela
 * coluna firestore_id e atualizados, sem duplicar. A ordem respeita as
 * dependências entre as tabelas.
 */
class FirestoreImportSeeder extends Seeder
{
    public function run(): void
    {
        if (! FirestoreDump::exists()) {
            $this->command?->warn('Exportação do Firebase não encontrada em '.FirestoreDump::path().'. Importação ignorada.');

            return;
        }

        DB::transaction(function (): void {
            $this->call([
                UserSeeder::class,
                CatalogItemSeeder::class,
                GameSessionSeeder::class,
                RuleSetSeeder::class,
                GameCatalogSeeder::class,
                CharacterSeeder::class,
                JournalEntrySeeder::class,
                SuggestionSeeder::class,
                ChatMessageSeeder::class,
                CampaignMapSeeder::class,
                MapAnnotationSeeder::class,
                DungeonStateSeeder::class,
            ]);
        });
    }
}
