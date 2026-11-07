<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Administradores
    |--------------------------------------------------------------------------
    |
    | E-mails (separados por vírgula) que recebem o papel de administrador
    | na importação dos dados do Firebase. Substitui o e-mail fixo que o
    | sistema antigo usava nas regras do Firestore.
    |
    */

    'admin_emails' => array_values(array_filter(array_map(
        static fn (string $email): string => strtolower(trim($email)),
        explode(',', (string) env('ARQUIVO_ADMIN_EMAILS', '')),
    ))),

    /*
    |--------------------------------------------------------------------------
    | Importação do Firebase
    |--------------------------------------------------------------------------
    |
    | Caminho do arquivo JSON exportado do Firestore e disco onde as imagens
    | embutidas (base64) são gravadas durante a importação.
    |
    */

    'import' => [
        'dump_path' => env('ARQUIVO_IMPORT_DUMP_PATH') ?: base_path('../dump_data/firestore_dump.json'),
        'disk' => 'public',
    ],

    /*
    |--------------------------------------------------------------------------
    | Política de Privacidade
    |--------------------------------------------------------------------------
    |
    | Dados exibidos na página /politica-de-privacidade. Atualize a data
    | sempre que o texto mudar. O serviço de IA só aparece na política
    | quando a geração de mapas por IA estiver ativa.
    |
    */

    'privacy' => [
        'controller' => '[NOME DO RESPONSÁVEL OU EMPRESA]',
        'contact_email' => 'guilherme.higino@gmail.com',
        'updated_at' => '2026-11-03',
        'hosting_provider' => '[PROVEDOR DE HOSPEDAGEM]',
        'mail_provider' => '[PROVEDOR DE E-MAIL]',
        'ai_maps_service' => null,
        'deletion_days' => 30,
        'response_days' => 15,
    ],

    /*
    |--------------------------------------------------------------------------
    | Regras padrão
    |--------------------------------------------------------------------------
    |
    | Valores usados quando as regras globais ou da sessão (rule_sets) não
    | definem o campo. São os mesmos padrões do sistema antigo.
    |
    */

    'rules' => [
        'formulas' => [
            'pv' => '((FOR / 2) + CON) * 10',
            'atp' => '(INT + 3) * 3',
            'soco' => 'FOR',
            'chute' => 'FOR + (FOR / 2)',
            'en' => '20 - ((AGI + (PER / 2)) + (LUTA * 2))',
            'dm' => '20 - ((AGI + (PER / 2)) + (MISTICA * 2))',
            'defesa' => 'CON + (AGI / 2) + (LUTA * 2)',
            'esquiva' => '(CON + AGI + (VEL / 2)) + (LUTA * 2)',
            'skill_cost' => '(COST * LVL) / VAR',
            'power_cost' => '(COST * LVL)',
        ],

        'difficulty' => [
            'easy_mod' => 2,
            'hard_div' => 2,
            'extreme_div' => 5,
        ],

        'attributes' => [
            ['id' => 'for', 'label' => 'Força'],
            ['id' => 'con', 'label' => 'Constituição'],
            ['id' => 'agi', 'label' => 'Agilidade'],
            ['id' => 'per', 'label' => 'Percepção'],
            ['id' => 'vel', 'label' => 'Velocidade'],
            ['id' => 'ini', 'label' => 'Iniciativa'],
            ['id' => 'int', 'label' => 'Inteligência'],
            ['id' => 'cor', 'label' => 'Coragem'],
        ],

        'skill_type_vars' => ['Luta' => '1', 'Mística' => '1'],

        // Pontos iniciais da criação de personagem (padrões do sistema antigo).
        'points' => [
            'max_attribute_points' => 28,
            'max_single_attribute_value' => 10,
            'initial_skill_points' => 10,
            'initial_power_points' => 5,
            'initial_money' => 500,
        ],

        // Carga máxima do inventário, em kg (fixa no sistema antigo).
        'carry_capacity' => 150,
    ],

];
