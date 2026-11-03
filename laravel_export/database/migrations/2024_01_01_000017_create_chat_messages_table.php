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
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->index();
            $table->string('sender_id', 128)->nullable();
            $table->string('sender_name')->nullable();
            $table->text('sender_photo')->nullable();
            $table->text('text')->nullable();
            $table->string('type')->nullable();
            $table->json('roll_result')->nullable();
            $table->timestamp('timestamp')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
