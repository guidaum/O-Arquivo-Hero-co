<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Áudio do mestre (fase 9c):
 * - rule_sets.sound_settings guarda os efeitos além dos cinco sons de dados
 *   (ataque, escudo, porta, rugido...) e a trilha ambiente personalizada;
 * - dungeon_atmospheres ganha o último efeito tocado "para a mesa", que os
 *   jogadores recebem pelo polling da ambientação da campanha.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rule_sets', function (Blueprint $table): void {
            $table->json('sound_settings')->nullable();
        });

        Schema::table('dungeon_atmospheres', function (Blueprint $table): void {
            $table->string('effect_key', 32)->nullable();
            $table->dateTime('effect_at', 3)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rule_sets', function (Blueprint $table): void {
            $table->dropColumn('sound_settings');
        });

        Schema::table('dungeon_atmospheres', function (Blueprint $table): void {
            $table->dropColumn(['effect_key', 'effect_at']);
        });
    }
};
