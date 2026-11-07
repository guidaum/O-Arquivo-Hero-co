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
     * Peso e valor (carga e patrimônio do inventário) e a ordem manual
     * dos itens, que o inventário do sistema antigo usava.
     */
    public function up(): void
    {
        Schema::table('character_items', function (Blueprint $table) {
            $table->decimal('weight', 8, 2)->default(0)->after('defense');
            $table->unsignedBigInteger('value')->default(0)->after('weight');
            $table->unsignedInteger('position')->default(0)->after('equipped');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('character_items', function (Blueprint $table) {
            $table->dropColumn(['weight', 'value', 'position']);
        });
    }
};
