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
        Schema::create('item_catalog', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('rarity')->nullable();
            $table->decimal('weight', 8, 2)->default(0);
            $table->integer('value')->default(0);
            $table->text('description')->nullable();
            $table->text('image')->nullable();
            $table->string('image_path')->nullable();
            $table->json('stats')->nullable();
            $table->string('damage')->nullable();
            $table->integer('defense')->default(0);
            $table->string('created_by', 128)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('item_catalog');
    }
};
