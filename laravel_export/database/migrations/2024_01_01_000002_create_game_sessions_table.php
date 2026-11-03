<?php

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
        Schema::create('game_sessions', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('code', 32)->index();
            $table->string('gm_id', 128)->index();
            $table->text('description')->nullable();
            $table->longText('image')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('active')->default(true);
            $table->json('player_ids')->nullable();
            $table->json('map_settings')->nullable();
            $table->json('attributes')->nullable();
            $table->json('combat_tracker')->nullable();
            $table->text('dice_roll_sound')->nullable();
            $table->text('critical_sound')->nullable();
            $table->text('fumble_sound')->nullable();
            $table->text('success_sound')->nullable();
            $table->text('failure_sound')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_sessions');
    }
};
