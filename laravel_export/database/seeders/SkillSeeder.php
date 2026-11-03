<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SkillSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('skills')->delete();

        $records = [
            [
                'id' => '0b5563m3mNxiHfiLRmSo',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Piloto de Fuga',
                'type' => 'Empírico',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você dirige muito bem.',
                'created_at' => '2026-04-03T08:43:49.172Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => '3qq3bQlcMnN5LTWIKg3u',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Furtividade',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você ganha vantagem em testes de furtividade.',
                'created_at' => '2026-03-31T16:03:48.544Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => '7vOZIzZbJ5J7WZXWt133',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Atuação',
                'type' => 'Artes',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Capacidade de executar performances artísticas para dissimular.',
                'created_at' => '2026-03-31T15:54:59.038Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'A9rkZdESgcFwlJgqmMQA',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Comunicação',
                'type' => 'Artes',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Facilidade de convencer pessoas em negociações, persuasão.',
                'created_at' => '2026-03-31T15:52:41.480Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'AWRoI7qAoJVKmMEYPIPk',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Furto',
                'type' => 'Empírico',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você tem mãos ligeiras, consegue roubar uma pessoa sem que ela perceba.',
                'created_at' => '2026-03-31T16:02:12.822Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'CVEY0XEey2e5IOxFkilQ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Pontaria',
                'type' => 'Treinamento',
                'atp_cost' => 1,
                'damage' => null,
                'description' => 'Proporciona vantagem na utilização de arma de fogo.',
                'created_at' => '2026-03-31T21:45:36.003Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'EqBDKUZRdVTKQinje6jj',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Especialização em Armas Brancas',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => '1d4',
                'description' => 'Você é especialista em uma arma específica à sua escolha. Isso garante bônus na utilização dessa arma.',
                'created_at' => '2026-04-03T08:40:01.181Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'HCPLPSjZ7ewbWHYtzaqM',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Leitura de Microexpressões',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você é capaz de analisar detalhes singelos no comportamento das pessoas, e dessa forma descobrir se ela está mentindo ou tentar deduzir suas intenções.',
                'created_at' => '2026-03-31T21:51:06.126Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'MFpxNdXXjQc2FwMTEaya',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Investigação',
                'type' => 'Empírico',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Capacidade de encontrar pistas e fazer análises no ambiente a fim de desvendar um mistério.',
                'created_at' => '2026-03-31T15:51:37.681Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'MX3YczQQULXio31fb1i8',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Guitarrista',
                'type' => 'Artes',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Confere bônus ao tocar guitarra ou outros instrumentos similares.',
                'created_at' => '2026-03-31T14:14:18.296Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'NOxtsKXWEbIU1C44oNnP',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Piloto de Helicóptero',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você sabe pilotar helicópteros.',
                'created_at' => '2026-04-03T08:45:31.859Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'O9eF5jbdwQFzN9drv1og',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Línguas',
                'type' => 'Estudos',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Confere conhecimento de uma língua moderna por nível',
                'created_at' => '2026-03-30T10:37:24.697Z',
                'updated_at' => '2026-03-30T11:34:56.726Z'
            ],
            [
                'id' => 'OwpxyZWSETkz8JGiE6Hw',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Perito em armas brancas',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => 'AGI',
                'description' => 'Utilizando armas brancas você ganha bônus de dano baseado em sua agilidade durante um combate corpo a corpo. Também confere vantagem em combate corpo a corpo, caso o oponente não seja perito em armas brancas.',
                'created_at' => '2026-03-30T12:53:42.183Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'PeUOtzpRu0n9Pq1zRkTN',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Piloto de Avião',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você sabe pilotar aviões.',
                'created_at' => '2026-04-03T08:44:47.633Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'SGEQwSodBJ5AQNZElqUi',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Combatente de Escudo',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Ganha bônus em defesa com escudo.',
                'created_at' => '2026-04-03T09:53:41.865Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'TyvMZehLoe3GVlWhh9re',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Biotecnologia',
                'type' => 'Geral',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você se especializou em desenvolver tecnologias na área da saúde, com um laboratório e tempo, você consegue desenvolver curas e outros aparatos para saúde.',
                'created_at' => '2026-03-31T15:58:34.192Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'aA7zoYqfiPTkteh26pQj',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Especialização em Armas de Fogo',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => '1d6',
                'description' => 'Você é especialista em uma arma específica à sua escolha. Isso garante bônus na utilização dessa arma.',
                'created_at' => '2026-04-03T08:39:08.346Z',
                'updated_at' => '2026-04-03T08:40:18.636Z'
            ],
            [
                'id' => 'fuxUFbgvs6rlpB3XdaWt',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Línguas Antigas',
                'type' => 'Estudos',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Confere conhecimento de uma língua antiga por nível.',
                'created_at' => '2026-03-30T10:36:54.266Z',
                'updated_at' => '2026-03-30T11:35:26.324Z'
            ],
            [
                'id' => 'g2F7K7ES0FyK0O8wUavd',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Identificar Pistas',
                'type' => 'Empírico',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Observando o ambiente você é capaz de identificar pistas importantes no ambiente.',
                'created_at' => '2026-03-31T21:49:27.466Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'hGCX7bsnr3SMXwPq26ZQ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Perito em armas de fogo',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => '1D4 + PER',
                'description' => 'O treinamento em armas lhe dá vantagem na solução de panes e adiciona dano extra na utilização de armas de fogo.',
                'created_at' => '2026-03-30T12:48:55.724Z',
                'updated_at' => '2026-04-13T15:49:32.639Z'
            ],
            [
                'id' => 'hcEFARQjlBbtnF3f2yFe',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Ocultismo',
                'type' => 'Ocultismo',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Conhecimento geral sobre ocultismo, facilita no entendimento de símbolos e ritos.',
                'created_at' => '2026-03-30T10:43:28.833Z',
                'updated_at' => '2026-03-30T11:35:52.679Z'
            ],
            [
                'id' => 'jo5m1LTfcwFnaKwm93xR',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Sobrevivencialismo',
                'type' => 'Empírico',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Um sobrevivente tem vantagem em testes de sobrevivência, além de ganhar 1 de bônus em sobrevivência por nível de sobrevivencialismo.',
                'created_at' => '2026-03-30T15:48:38.334Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'jvAbYyKzGDrMLOBIqUyV',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Furtividade',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => null,
                'created_at' => '2026-04-11T18:12:01.516Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'kJbyyIDZR2OcMc7ogDOt',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Mira',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Utilizando um turno para se preparar, a mira garante um acerto com dano total da arma.',
                'created_at' => '2026-03-31T21:47:26.369Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'lD5mYr7lZan357fYxmLH',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Instrumentista',
                'type' => 'Artes',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Confere bônus em performances artísticas com instrumentos variados.',
                'created_at' => '2026-03-31T14:13:09.162Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'mJmIrVhwHMhUpnlHkKRY',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Lábia',
                'type' => 'Empírico',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Aplica desvantagem em testes de convicção do oponente, em situações onde a verdade é questionável. Em situações normais você é muito convincente.',
                'created_at' => '2026-03-31T14:16:44.844Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'rEhkJC0Ra1DBQRiqmCUf',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Arrombamento',
                'type' => 'Treinamento',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Com as ferramentas corretas você consegue abrir fechaduras, cadeados e outras trancas mecânicas.',
                'created_at' => '2026-03-31T16:00:33.855Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'uHHIW35GFzP2G4oX38Uz',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Saúde',
                'type' => 'Estudos',
                'atp_cost' => 0,
                'damage' => null,
                'description' => 'Você tem conhecimentos gerais da área da saúde, conferidos por sua graduação na área da biologia.',
                'created_at' => '2026-03-31T15:56:51.809Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'y1sDDhErrbQoiRG2IfWj',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Adestrar Animais',
                'type' => 'Empírico',
                'atp_cost' => 1,
                'damage' => null,
                'description' => 'Você sabe com lidar com os animais, consegue fazer amizade com eles.',
                'created_at' => '2026-04-03T08:35:41.451Z',
                'updated_at' => '2026-11-03T10:25:53.035Z'
            ],
            [
                'id' => 'zy1zILJLscEVkR8s03xi',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Artes Marciais',
                'type' => 'Luta',
                'atp_cost' => 2,
                'damage' => '1d4+FOR',
                'description' => 'Confere treinamento em uma arte marcial, seu conhecimento lhe permite executar golpes da arte escolhida, onde o dano ou efeito pode ser variável de acordo com a arte.',
                'created_at' => '2026-03-30T10:39:57.180Z',
                'updated_at' => '2026-03-30T11:36:17.868Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('skills')->insert($chunk);
        }
    }
}
