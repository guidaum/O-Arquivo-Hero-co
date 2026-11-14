<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sugestões de item do inventário, revisadas pelo mestre da campanha (e não
 * pelo administrador): a campanha que recebe a sugestão e o item de origem,
 * que passa a apontar para o item da loja quando a sugestão é aprovada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suggestions', function (Blueprint $table): void {
            $table->foreignId('game_session_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('character_item_id')->nullable()->after('game_session_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('suggestions', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('character_item_id');
            $table->dropConstrainedForeignId('game_session_id');
        });
    }
};
