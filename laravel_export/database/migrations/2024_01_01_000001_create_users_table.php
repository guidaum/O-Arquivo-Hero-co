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
        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('uid', 128)->unique();
            $table->string('email')->nullable();
            $table->string('display_name')->nullable();
            $table->text('photo_url')->nullable();
            $table->text('bio')->nullable();
            $table->string('location')->nullable();
            $table->string('phone_number')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->enum('role', ['admin', 'gm', 'user'])->default('user');
            $table->timestamp('last_active')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
