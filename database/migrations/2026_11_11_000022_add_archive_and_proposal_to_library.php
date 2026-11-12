<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogos com herança por campanha (App\Support\CampaignLibrary):
 * - archived_at: item excluído da base. Ele sai do catálogo base e das
 *   campanhas novas, mas as campanhas existentes ficam com a sua cópia;
 * - proposed_at: criação ou alteração feita pelo mestre na campanha,
 *   aguardando o admin levá-la para a base ou ignorá-la.
 */
return new class extends Migration
{
    private const TABLES = ['talents', 'skills', 'powers', 'traits', 'catalog_items'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->timestamp('archived_at')->nullable()->after('base_version')->index();
                $blueprint->timestamp('proposed_at')->nullable()->after('archived_at')->index();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->dropIndex(['archived_at']);
                $blueprint->dropIndex(['proposed_at']);
                $blueprint->dropColumn(['archived_at', 'proposed_at']);
            });
        }
    }
};
