<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TalentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('talents')->delete();

        $records = [
            [
                'id' => '6JiI3QGwig9Ih5rHV5wA',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Concentração',
                'description' => null,
                'composition' => '["int","per"]',
                'created_at' => '2026-03-25T13:41:52.318Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'ATfYQCpXcqi0F3VlI22W',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Conhecimento',
                'description' => null,
                'composition' => '["int","con"]',
                'created_at' => '2026-03-25T13:40:49.396Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'Db5uUVXx5p1h339XNroQ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Sobrevivência',
                'description' => null,
                'composition' => '["con","cor"]',
                'created_at' => '2026-03-25T13:41:14.063Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'FUYU0QDRH2DmonmDvJgf',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Convicção',
                'description' => null,
                'composition' => '["cor","ini"]',
                'created_at' => '2026-03-25T13:42:20.495Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'KwlejZKMenPQwnEPEHpN',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Furtividade',
                'description' => null,
                'composition' => '["agi","per"]',
                'created_at' => '2026-03-25T13:39:25.809Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'MsjGvU9j2OXmvJUqvmJV',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Memória',
                'description' => null,
                'composition' => '["int","con"]',
                'created_at' => '2026-03-25T13:42:48.454Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'N2iLp3LUe77t9VTcSQKJ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Lábia',
                'description' => 'Capacidade de convencer uma pessoa de algo ou atuar de forma que dissimule sua condição.',
                'composition' => '["int","ini"]',
                'created_at' => '2026-03-25T13:38:20.138Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'RykvZEpYJJmUYK49Hw7E',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Charme',
                'description' => null,
                'composition' => '["con","ini"]',
                'created_at' => '2026-10-23T16:12:06.046Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'U7YdOQbTTfKpdjerjel5',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Resiliência',
                'description' => 'Capacidade de resistir às adversidades, continuar mesmo com desconforto físico ou psicológico.',
                'composition' => '["con","int"]',
                'created_at' => '2026-11-01T10:23:35.925Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'VUxWEGNIM8Z8anZp656c',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Investigação',
                'description' => null,
                'composition' => '["ini","per"]',
                'created_at' => '2026-03-25T13:40:35.112Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'czv6pGZBFRcOd59mHwQw',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Fuga',
                'description' => null,
                'composition' => '["con","vel"]',
                'created_at' => '2026-10-24T08:53:48.410Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'hLgUKjEC4cl7TbYRHNBx',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Acrobacia',
                'description' => null,
                'composition' => '["agi","con"]',
                'created_at' => '2026-03-25T13:40:09.964Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'kNdAA3DECcjxnO7pnhlI',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Atuação',
                'description' => null,
                'composition' => '["agi","int"]',
                'created_at' => '2026-10-24T08:55:40.733Z',
                'updated_at' => '2026-11-03T10:25:53.034Z'
            ],
            [
                'id' => 'up4m6AxGgLSvK1Borer5',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Intuição',
                'description' => 'Confere a capacidade de perceber micro expressões e detalhes subjetivos em pessoas e no ambiente.',
                'composition' => '["int","per"]',
                'created_at' => '2026-06-20T17:08:57.381Z',
                'updated_at' => '2026-10-04T14:01:14.763Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('talents')->insert($chunk);
        }
    }
}
