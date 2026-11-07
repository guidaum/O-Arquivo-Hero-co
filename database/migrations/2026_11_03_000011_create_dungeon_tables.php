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
     * Estado do battlemap de masmorra. Cada combinação de campanha e mapa
     * tem seus próprios tokens, névoa, áreas de efeito, marcadores e
     * atmosfera (no Firebase, a chave "session_{sessão}_{mapa}").
     */
    public function up(): void
    {
        Schema::create('dungeon_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('character_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('type', 16)->default('player');
            $table->string('avatar_path')->nullable();
            $table->string('color', 32)->nullable();
            $table->decimal('x', 6, 3);
            $table->decimal('y', 6, 3);
            $table->decimal('size', 4, 2)->default(1);
            $table->integer('hp')->default(0);
            $table->integer('max_hp')->default(0);
            $table->integer('initiative')->default(0);
            $table->json('conditions')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->foreignId('last_moved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_moved_at')->nullable();
            $table->timestamps();
            $table->index(['game_session_id', 'campaign_map_id', 'updated_at']);
        });

        Schema::create('dungeon_fogs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            // Índices das células reveladas na grade.
            $table->json('revealed_cells');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['game_session_id', 'campaign_map_id']);
        });

        Schema::create('dungeon_aoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 16);
            $table->string('name')->nullable();
            $table->string('color', 32)->nullable();
            $table->decimal('x', 6, 3);
            $table->decimal('y', 6, 3);
            $table->decimal('target_x', 6, 3)->nullable();
            $table->decimal('target_y', 6, 3)->nullable();
            $table->unsignedSmallInteger('radius_feet')->default(5);
            $table->smallInteger('rotation')->default(0);
            $table->timestamps();
            $table->index(['game_session_id', 'campaign_map_id', 'updated_at']);
        });

        Schema::create('dungeon_markers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label');
            $table->string('category', 32)->nullable();
            $table->text('description')->nullable();
            $table->string('color', 32)->nullable();
            $table->decimal('x', 6, 3);
            $table->decimal('y', 6, 3);
            $table->timestamps();
            $table->index(['game_session_id', 'campaign_map_id', 'updated_at']);
        });

        // Ambientação sonora e clima. campaign_map_id nulo = padrão da campanha.
        Schema::create('dungeon_atmospheres', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_map_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('soundscape', 64)->nullable();
            $table->string('weather', 64)->nullable();
            $table->unsignedTinyInteger('volume')->default(50);
            $table->string('custom_ambient_name')->nullable();
            $table->string('custom_ambient_path')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['game_session_id', 'campaign_map_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dungeon_atmospheres');
        Schema::dropIfExists('dungeon_markers');
        Schema::dropIfExists('dungeon_aoes');
        Schema::dropIfExists('dungeon_fogs');
        Schema::dropIfExists('dungeon_tokens');
    }
};
