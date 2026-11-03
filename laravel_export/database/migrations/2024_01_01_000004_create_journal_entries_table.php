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
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('owner_id', 128)->index();
            $table->string('game_session_id', 128)->nullable()->index();
            $table->string('character_id', 128)->nullable()->index();
            $table->string('title');
            $table->string('date')->nullable();
            $table->string('type')->nullable();
            $table->integer('xp')->default(0);
            $table->longText('content')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('journal_entries');
    }
};
