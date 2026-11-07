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
        Schema::create('game_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('gm_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('code', 32)->unique();
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->text('gm_notes')->nullable();
            $table->boolean('active')->default(true);
            $table->boolean('shop_enabled')->default(false);
            $table->timestamps();
        });

        Schema::create('game_session_user', function (Blueprint $table) {
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['game_session_id', 'user_id']);
        });

        Schema::create('game_session_shop_items', function (Blueprint $table) {
            $table->foreignId('game_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('catalog_item_id')->constrained()->cascadeOnDelete();
            $table->primary(['game_session_id', 'catalog_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_session_shop_items');
        Schema::dropIfExists('game_session_user');
        Schema::dropIfExists('game_sessions');
    }
};
