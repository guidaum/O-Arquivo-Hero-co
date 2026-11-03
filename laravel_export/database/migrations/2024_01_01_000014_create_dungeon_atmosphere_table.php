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
        Schema::create('dungeon_atmosphere', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('dungeon_id', 128)->nullable()->index();
            $table->string('preset')->nullable();
            $table->integer('intensity')->default(50);
            $table->json('config')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dungeon_atmosphere');
    }
};
