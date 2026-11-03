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
     * Regras de cálculo do sistema. O registro com game_session_id nulo é a
     * configuração global (globalSettings/config no Firebase); cada sessão
     * pode ter o seu próprio conjunto de regras.
     */
    public function up(): void
    {
        Schema::create('rule_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_session_id')->nullable()->unique()->constrained()->cascadeOnDelete();

            // Pontos iniciais e progressão por nível.
            $table->unsignedInteger('max_attribute_points')->default(0);
            $table->unsignedInteger('max_single_attribute_value')->default(0);
            $table->unsignedInteger('initial_skill_points')->default(0);
            $table->unsignedInteger('initial_power_points')->default(0);
            $table->unsignedBigInteger('initial_money')->default(0);
            $table->unsignedInteger('attr_points_per_level')->default(0);
            $table->unsignedInteger('skill_points_per_level')->default(0);
            $table->unsignedInteger('power_points_per_level')->default(0);

            // Valores padrão para NPCs.
            $table->integer('npc_default_min_attr')->default(0);
            $table->integer('npc_default_max_attr')->default(0);
            $table->unsignedInteger('npc_default_attr_points')->default(0);
            $table->unsignedInteger('npc_default_skill_points')->default(0);
            $table->unsignedInteger('npc_default_power_points')->default(0);

            // Modificadores de dificuldade. Nulo usa o padrão de config/arquivo.php.
            $table->decimal('diff_easy_mod', 8, 2)->nullable();
            $table->decimal('diff_hard_div', 8, 2)->nullable();
            $table->decimal('diff_extreme_div', 8, 2)->nullable();

            // Fórmulas avaliadas em tempo de execução (nunca com eval()).
            $table->string('pv_formula')->nullable();
            $table->string('atp_formula')->nullable();
            $table->string('soco_formula')->nullable();
            $table->string('chute_formula')->nullable();
            $table->string('defesa_formula')->nullable();
            $table->string('esquiva_formula')->nullable();
            $table->string('en_formula')->nullable();
            $table->string('dm_formula')->nullable();
            $table->string('skill_cost_formula')->nullable();
            $table->string('power_cost_formula')->nullable();

            // Variáveis por tipo de perícia/poder, atributos exibidos e categorias de talento.
            $table->json('skill_type_vars')->nullable();
            $table->json('power_type_vars')->nullable();
            $table->json('calculation_vars')->nullable();
            $table->json('attributes')->nullable();
            $table->json('talent_categories')->nullable();

            // Sons dos resultados de rolagem.
            $table->string('dice_roll_sound')->nullable();
            $table->string('critical_sound')->nullable();
            $table->string('fumble_sound')->nullable();
            $table->string('success_sound')->nullable();
            $table->string('failure_sound')->nullable();

            $table->boolean('enable_email_password_auth')->default(true);
            $table->timestamps();
        });

        // Funcionalidades do menu liberadas por papel (globalSettings/menuFeatures no Firebase).
        Schema::create('role_features', function (Blueprint $table) {
            $table->id();
            $table->string('role', 16);
            $table->string('feature', 64);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
            $table->unique(['role', 'feature']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_features');
        Schema::dropIfExists('rule_sets');
    }
};
