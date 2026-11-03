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
        Schema::create('traits', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('name');
            $table->text('description')->nullable();
            $table->text('effect')->nullable();
            $table->json('effects')->nullable();
            $table->integer('modifier')->default(0);
            $table->string('modifier_type')->nullable();
            $table->enum('type', ['advantage', 'disadvantage'])->default('advantage');
            $table->integer('cost')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('traits');
    }
};
