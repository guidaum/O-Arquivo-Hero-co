<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Configurações por campanha com herança viva da base (App\Support\CampaignLibrary).
 *
 * Catálogos (talentos, perícias, poderes, traços e itens):
 * - linha da base: game_session_id e base_id nulos; version sobe a cada edição;
 * - versão da campanha: game_session_id + base_id (a linha da base). Guarda
 *   os dados que a campanha usa; o ID canônico continua sendo o da base, então
 *   fichas, loja e modificadores não mudam. base_version é a versão da base
 *   que o mestre já avaliou (nula = item novo da base ainda não adotado);
 *   hidden oculta o item na campanha;
 * - item só da campanha: game_session_id preenchido e base_id nulo.
 *
 * Regras (rule_sets): a global ganha version; a da campanha guarda
 * base_version e base_snapshot (valores da base que o mestre já avaliou),
 * usados para sugerir as mudanças da base campo a campo.
 */
return new class extends Migration
{
    private const LIBRARY_TABLES = ['talents', 'skills', 'powers', 'traits', 'catalog_items'];

    public function up(): void
    {
        foreach (['traits', 'catalog_items'] as $table) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->foreignId('game_session_id')->nullable()->after('id')->constrained()->nullOnDelete();
            });
        }

        foreach (self::LIBRARY_TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table): void {
                $blueprint->foreignId('base_id')->nullable()->after('game_session_id')->constrained($table)->cascadeOnDelete();
                $blueprint->boolean('hidden')->default(false)->after('base_id');
                $blueprint->unsignedInteger('version')->default(1)->after('hidden');
                $blueprint->unsignedInteger('base_version')->nullable()->after('version');
                $blueprint->unique(['game_session_id', 'base_id']);
            });
        }

        Schema::table('rule_sets', function (Blueprint $table): void {
            $table->unsignedInteger('version')->default(1)->after('game_session_id');
            $table->unsignedInteger('base_version')->nullable()->after('version');
            $table->json('base_snapshot')->nullable()->after('base_version');
        });

        $this->snapshotExistingCampaignRules();
    }

    public function down(): void
    {
        Schema::table('rule_sets', function (Blueprint $table): void {
            $table->dropColumn(['version', 'base_version', 'base_snapshot']);
        });

        foreach (self::LIBRARY_TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->dropUnique(['game_session_id', 'base_id']);
                $blueprint->dropConstrainedForeignId('base_id');
                $blueprint->dropColumn(['hidden', 'version', 'base_version']);
            });
        }

        foreach (['traits', 'catalog_items'] as $table) {
            Schema::table($table, function (Blueprint $blueprint): void {
                $blueprint->dropConstrainedForeignId('game_session_id');
            });
        }
    }

    /**
     * Regras de campanha que já existem passam a ter como referência a base
     * atual: só mudanças futuras da base viram sugestão.
     */
    private function snapshotExistingCampaignRules(): void
    {
        $global = DB::table('rule_sets')->whereNull('game_session_id')->first();

        if ($global === null) {
            return;
        }

        $ignored = ['id', 'game_session_id', 'version', 'base_version', 'base_snapshot', 'enable_email_password_auth', 'created_at', 'updated_at'];
        $jsonColumns = ['skill_type_vars', 'power_type_vars', 'calculation_vars', 'attributes', 'talent_categories', 'sound_settings'];
        $snapshot = [];

        // Escalares ficam como vieram do banco: a comparação normaliza números (RuleSet::normalize()).
        foreach ((array) $global as $column => $value) {
            if (! in_array($column, $ignored, true)) {
                $snapshot[$column] = in_array($column, $jsonColumns, true) && $value !== null
                    ? json_decode((string) $value, true)
                    : $value;
            }
        }

        DB::table('rule_sets')->whereNotNull('game_session_id')->update([
            'base_version' => 1,
            'base_snapshot' => json_encode($snapshot, JSON_UNESCAPED_UNICODE),
        ]);
    }
};
