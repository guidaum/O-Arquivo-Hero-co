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
        Schema::create('world_maps', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('subtitle')->nullable();
            $table->longText('image_url')->nullable();
            $table->string('default_scale')->nullable();
            $table->boolean('active')->default(true);
            $table->string('session_id', 128)->nullable()->index();
            $table->string('created_by', 128)->nullable();
            $table->json('layer_settings')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('world_maps');
    }
};
