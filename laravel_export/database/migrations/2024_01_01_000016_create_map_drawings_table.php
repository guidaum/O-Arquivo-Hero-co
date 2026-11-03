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
        Schema::create('map_drawings', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('map_id', 128)->nullable()->index();
            $table->json('paths')->nullable();
            $table->string('created_by', 128)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_drawings');
    }
};
