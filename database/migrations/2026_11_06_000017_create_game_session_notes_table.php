<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Anotações rápidas do mestre na campanha (quickNotes do documento da
 * sessão no sistema antigo). As do personagem ficam em character_notes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_session_notes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('category', 64)->nullable();
            $table->text('content')->nullable();
            $table->boolean('pinned')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_session_notes');
    }
};
