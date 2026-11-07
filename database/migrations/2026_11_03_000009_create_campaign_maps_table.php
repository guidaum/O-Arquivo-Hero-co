<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Mapas do mundo e masmorras. Os mapas padrão do sistema (preset_key
     * preenchido) ficam disponíveis para todas as campanhas; os mapas
     * personalizados pertencem a uma sessão.
     */
    public function up(): void
    {
        Schema::create('campaign_maps', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->string('preset_key', 32)->nullable()->unique();
            $table->string('type', 16)->index();
            $table->foreignId('game_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->string('theme', 64)->nullable();
            $table->string('image_path')->nullable();
            // Masmorras: grade e entrada (coordenadas em %).
            $table->unsignedSmallInteger('grid_cols')->nullable();
            $table->unsignedSmallInteger('grid_rows')->nullable();
            $table->decimal('entrance_x', 6, 3)->nullable();
            $table->decimal('entrance_y', 6, 3)->nullable();
            // Mapas do mundo: escala exibida.
            $table->string('default_scale', 64)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Configuração de cada mapa dentro de uma campanha (mapSettings no Firebase).
        Schema::create('game_session_maps', function (Blueprint $table) {
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->boolean('active')->default(true);
            $table->json('layer_settings')->nullable();
            $table->timestamps();
            $table->primary(['game_session_id', 'campaign_map_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_session_maps');
        Schema::dropIfExists('campaign_maps');
    }
};
