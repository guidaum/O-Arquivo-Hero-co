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
     * Marcações sobre os mapas (mundo e masmorra), sempre em coordenadas
     * percentuais (0 a 100) e sempre no contexto de uma campanha.
     */
    public function up(): void
    {
        Schema::create('map_pins', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('category', 32)->nullable();
            $table->string('custom_icon', 64)->nullable();
            $table->string('danger_level', 32)->nullable();
            $table->string('status', 32)->nullable();
            $table->text('description')->nullable();
            $table->text('secrets')->nullable();
            $table->string('image_path')->nullable();
            $table->json('tags')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->string('discovered_by_name')->nullable();
            $table->date('discovered_on')->nullable();
            $table->decimal('x', 6, 3);
            $table->decimal('y', 6, 3);
            $table->timestamps();
        });

        // Desenhos livres e polígonos (mapDrawings e dungeonDrawings no Firebase).
        Schema::create('map_drawings', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->json('points');
            $table->string('color', 32);
            $table->string('fill_color', 32)->nullable();
            $table->unsignedSmallInteger('size')->default(3);
            $table->boolean('is_closed')->default(false);
            $table->boolean('is_polygon')->default(false);
            $table->timestamps();
            $table->index(['game_session_id', 'campaign_map_id', 'updated_at']);
        });

        // Sinalizações temporárias (worldMapPings e dungeonPings). Não são importadas.
        Schema::create('map_pings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('color', 32);
            $table->decimal('x', 6, 3);
            $table->decimal('y', 6, 3);
            $table->timestamps();
            $table->index(['game_session_id', 'campaign_map_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_pings');
        Schema::dropIfExists('map_drawings');
        Schema::dropIfExists('map_pins');
    }
};
