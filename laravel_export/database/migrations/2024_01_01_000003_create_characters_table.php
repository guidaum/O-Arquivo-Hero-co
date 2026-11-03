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
        Schema::create('characters', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('owner_id', 128)->index();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('name');
            $table->string('class')->nullable();
            $table->integer('level')->default(1);
            $table->integer('xp')->default(0);
            $table->integer('xp_max')->default(1000);
            $table->longText('image')->nullable();
            $table->string('image_path')->nullable();
            $table->string('color', 32)->nullable();
            $table->string('icon', 64)->nullable();
            $table->json('stats')->nullable();
            $table->json('stats_mods')->nullable();
            $table->json('talent_mods')->nullable();
            $table->boolean('can_edit_stats')->default(false);
            $table->json('skills')->nullable();
            $table->json('powers')->nullable();
            $table->json('traits')->nullable();
            $table->json('inventory')->nullable();
            $table->integer('atp')->nullable();
            $table->json('model_sheet_3d')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
