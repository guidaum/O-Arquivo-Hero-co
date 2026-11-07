<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * NPCs do mestre podem ser monstros hostis (isMonster e monsterSize no
 * sistema antigo): o tamanho vira o tamanho do token no battlemap.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->boolean('is_monster')->default(false)->after('is_npc');
            $table->unsignedTinyInteger('monster_size')->default(1)->after('is_monster');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->dropColumn(['is_monster', 'monster_size']);
        });
    }
};
