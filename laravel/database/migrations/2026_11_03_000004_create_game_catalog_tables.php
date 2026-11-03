<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Talentos, perícias, poderes e traços. Quando game_session_id é nulo,
     * o registro é global; caso contrário, pertence à campanha do mestre.
     */
    public function up(): void
    {
        Schema::create('talents', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category', 64)->nullable();
            // Chaves dos atributos que compõem o talento (ex.: ["int", "per"]).
            $table->json('composition')->nullable();
            $table->timestamps();
        });

        Schema::create('skills', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('type', 64)->index();
            $table->text('description')->nullable();
            $table->string('damage', 64)->nullable();
            $table->integer('atp_cost')->default(0);
            $table->integer('purchase_cost')->default(0);
            $table->string('difficulty_formula')->nullable();
            $table->timestamps();
        });

        Schema::create('powers', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->foreignId('game_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('type', 64)->index();
            $table->text('description')->nullable();
            $table->text('effect')->nullable();
            // Custo de uso; pode ser número ou expressão.
            $table->string('cost', 64)->nullable();
            $table->integer('purchase_cost')->default(0);
            $table->string('difficulty_formula')->nullable();
            $table->timestamps();
        });

        Schema::create('traits', function (Blueprint $table) {
            $table->id();
            $table->string('firestore_id', 64)->nullable()->unique();
            $table->string('name');
            $table->string('type', 16)->index();
            $table->text('description')->nullable();
            $table->text('effect')->nullable();
            $table->integer('modifier')->default(0);
            // O alvo do modificador é um atributo (ex.: "for") ou um talento.
            $table->string('modifier_attribute', 16)->nullable();
            $table->foreignId('modifier_talent_id')->nullable()->constrained('talents')->nullOnDelete();
            $table->integer('purchase_cost')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('traits');
        Schema::dropIfExists('powers');
        Schema::dropIfExists('skills');
        Schema::dropIfExists('talents');
    }
};
