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
        Schema::create('map_pins', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('map_id', 128)->nullable()->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('x', 8, 4);
            $table->decimal('y', 8, 4);
            $table->string('type')->nullable();
            $table->text('custom_map_url')->nullable();
            $table->string('created_by', 128)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('map_pins');
    }
};
