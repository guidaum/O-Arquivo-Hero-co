<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Combate compartilhado na masmorra: no sistema antigo só a rodada era
 * sincronizada e cada navegador tinha o seu "turno ativo". Aqui o turno
 * fica no servidor e todos veem o mesmo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dungeon_atmospheres', function (Blueprint $table): void {
            $table->boolean('in_combat')->default(false);
            $table->unsignedSmallInteger('combat_round')->default(1);
            $table->foreignId('active_token_id')->nullable()->constrained('dungeon_tokens')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('dungeon_atmospheres', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('active_token_id');
            $table->dropColumn(['in_combat', 'combat_round']);
        });
    }
};
