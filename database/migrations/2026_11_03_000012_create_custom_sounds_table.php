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
        Schema::create('custom_sounds', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('category', 32)->default('combat');
            $table->string('type', 16)->default('sfx');
            // "upload" (arquivo em disco) ou "url" (endereço externo).
            $table->string('source_type', 16)->default('upload');
            $table->string('path');
            $table->unsignedBigInteger('size')->nullable();
            $table->string('format', 16)->nullable();
            $table->decimal('duration', 8, 2)->nullable();
            // Som do sistema substituído por este (ex.: "diceRoll").
            $table->string('system_sound_key', 64)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('custom_sounds');
    }
};
