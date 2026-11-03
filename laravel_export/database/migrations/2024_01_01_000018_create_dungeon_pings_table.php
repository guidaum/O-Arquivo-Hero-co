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
        Schema::create('dungeon_pings', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('dungeon_id', 128)->nullable()->index();
            $table->decimal('x', 8, 4);
            $table->decimal('y', 8, 4);
            $table->string('user_name')->nullable();
            $table->string('user_color', 32)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dungeon_pings');
    }
};
