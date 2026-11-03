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
        Schema::create('dungeon_tokens', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('map_id', 128)->nullable()->index();
            $table->string('token_id', 128)->nullable();
            $table->string('name')->nullable();
            $table->integer('col')->default(0);
            $table->integer('row')->default(0);
            $table->string('color', 32)->nullable();
            $table->text('avatar')->nullable();
            $table->string('type', 32)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dungeon_tokens');
    }
};
