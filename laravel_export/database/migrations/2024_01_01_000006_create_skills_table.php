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
        Schema::create('skills', function (Blueprint $table) {
            $table->string('id', 128)->primary();
            $table->string('session_id', 128)->nullable()->index();
            $table->string('gm_id', 128)->nullable()->index();
            $table->string('name');
            $table->string('type')->nullable();
            $table->integer('atp_cost')->default(0);
            $table->string('damage')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('skills');
    }
};
