<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Referências visuais do mestre na campanha (Escudo do Mestre): imagens de
 * cenários, NPCs, criaturas e itens, enviadas como arquivo (disco "public")
 * ou guardadas como link externo em image_path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_session_references', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('category', 32)->default('scene');
            $table->string('image_path');
            $table->text('notes')->nullable();
            $table->boolean('pinned')->default(false);
            $table->timestamps();

            $table->index(['game_session_id', 'pinned']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_session_references');
    }
};
