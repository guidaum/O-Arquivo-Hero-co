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
        Schema::create('catalog_items', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('category', 64)->index();
            $table->string('rarity', 32)->nullable();
            $table->text('description')->nullable();
            $table->string('damage', 64)->nullable();
            $table->integer('defense')->default(0);
            $table->decimal('weight', 8, 2)->default(0);
            $table->unsignedBigInteger('value')->default(0);
            $table->json('stats')->nullable();
            $table->string('bonus_text')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_starting_item')->default(false);
            $table->timestamps();
        });

        // Relaciona itens entre si (por exemplo, munição e as armas que a utilizam).
        Schema::create('catalog_item_relations', function (Blueprint $table) {
            $table->foreignId('catalog_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('related_item_id')->constrained('catalog_items')->cascadeOnDelete();
            $table->primary(['catalog_item_id', 'related_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('catalog_item_relations');
        Schema::dropIfExists('catalog_items');
    }
};
