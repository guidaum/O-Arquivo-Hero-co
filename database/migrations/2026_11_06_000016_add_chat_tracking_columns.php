<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chat por polling:
 * - users.notifications_seen_at: menções depois desta data contam como não lidas;
 * - game_sessions.chat_cleared_at: avisa quem está com o chat aberto que o mestre limpou as mensagens;
 * - índice das menções por usuário (consulta do sino de notificações).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('notifications_seen_at')->nullable();
        });

        Schema::table('game_sessions', function (Blueprint $table): void {
            $table->timestamp('chat_cleared_at')->nullable();
        });

        Schema::table('chat_message_mentions', function (Blueprint $table): void {
            $table->index(['user_id', 'chat_message_id']);
        });
    }

    public function down(): void
    {
        Schema::table('chat_message_mentions', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'chat_message_id']);
        });

        Schema::table('game_sessions', function (Blueprint $table): void {
            $table->dropColumn('chat_cleared_at');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('notifications_seen_at');
        });
    }
};
