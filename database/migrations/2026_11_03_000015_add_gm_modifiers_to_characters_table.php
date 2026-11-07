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
     * Modificadores do mestre por atributo ou talento, com justificativa:
     * {"for": [{"id": "...", "value": 1, "justification": "...", "author_id": 1, "author_name": "...", "created_at": "..."}]}.
     * A chave é a sigla do atributo ou "talent:<id>".
     */
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->json('gm_modifiers')->nullable()->after('talent_mods');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropColumn('gm_modifiers');
        });
    }
};
