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
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('game_session_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('class')->nullable();
            $table->string('image_path')->nullable();
            $table->string('color', 32)->nullable();
            $table->string('icon', 64)->nullable();
            $table->boolean('is_npc')->default(false);
            $table->boolean('can_edit_stats')->default(false);

            // Progressão.
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('xp')->default(0);
            $table->unsignedInteger('xp_max')->default(1000);
            $table->integer('attribute_points')->default(0);
            $table->integer('skill_points')->default(0);
            $table->integer('power_points')->default(0);

            // Estado atual.
            $table->integer('current_pv')->default(0);
            $table->integer('temp_pv')->default(0);
            $table->integer('current_atp')->default(0);
            $table->integer('protection')->default(0);
            $table->integer('awakening')->default(0);
            $table->integer('sanity')->default(0);
            $table->bigInteger('money')->default(0);

            // Atributos: valores base, finais e modificadores ({"for": 3, ...}).
            $table->json('base_stats')->nullable();
            $table->json('stats')->nullable();
            $table->json('stats_mods')->nullable();
            // Modificadores por talento ({"<talent_id>": 1, ...}).
            $table->json('talent_mods')->nullable();
            $table->json('model_sheet_3d')->nullable();
            $table->timestamps();
        });

        Schema::create('character_skill', function (Blueprint $table) {
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('skill_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('level')->default(1);
            $table->string('type', 64)->nullable();
            $table->text('description')->nullable();
            $table->primary(['character_id', 'skill_id']);
        });

        Schema::create('character_power', function (Blueprint $table) {
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('power_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('level')->default(1);
            $table->string('type', 64)->nullable();
            $table->text('description')->nullable();
            $table->primary(['character_id', 'power_id']);
        });

        Schema::create('character_trait', function (Blueprint $table) {
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('trait_id')->constrained()->cascadeOnDelete();
            $table->primary(['character_id', 'trait_id']);
        });

        // Equipamentos do personagem: cópias editáveis, opcionalmente ligadas ao catálogo.
        Schema::create('character_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->foreignId('catalog_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('category', 64)->nullable();
            $table->string('rarity', 32)->nullable();
            $table->text('description')->nullable();
            $table->string('damage', 64)->nullable();
            $table->integer('defense')->default(0);
            $table->string('ammo', 64)->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->boolean('equipped')->default(false);
            $table->json('stats')->nullable();
            $table->string('image_path')->nullable();
            $table->timestamps();
        });

        Schema::create('character_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('category', 64)->nullable();
            $table->text('content')->nullable();
            $table->boolean('pinned')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('character_notes');
        Schema::dropIfExists('character_items');
        Schema::dropIfExists('character_trait');
        Schema::dropIfExists('character_power');
        Schema::dropIfExists('character_skill');
        Schema::dropIfExists('characters');
    }
};
