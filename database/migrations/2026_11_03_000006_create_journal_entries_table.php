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
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('game_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('character_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->date('session_date')->nullable();
            $table->string('duration', 64)->nullable();
            $table->string('location')->nullable();
            $table->unsignedInteger('players_count')->default(0);
            $table->longText('content')->nullable();
            // Eventos ({time, event, type, status}) e NPCs ({name, role, status, image_path}).
            $table->json('timeline')->nullable();
            $table->json('npcs')->nullable();
            $table->timestamps();
        });

        Schema::create('journal_entry_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('journal_entry_images');
        Schema::dropIfExists('journal_entries');
    }
};
