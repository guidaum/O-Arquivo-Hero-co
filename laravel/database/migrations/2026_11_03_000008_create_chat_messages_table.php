<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Nome exibido no momento do envio; preservado se o usuário for removido.
            $table->string('sender_name');
            $table->string('type', 16)->default('text');
            $table->text('text')->nullable();
            $table->string('image_path')->nullable();
            $table->json('roll_data')->nullable();
            $table->boolean('should_notify')->default(false);
            $table->timestamps();

            // Consulta do polling: mensagens novas de uma sessão.
            $table->index(['game_session_id', 'id']);
        });

        Schema::create('chat_message_mentions', function (Blueprint $table) {
            $table->foreignId('chat_message_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['chat_message_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_message_mentions');
        Schema::dropIfExists('chat_messages');
    }
};
