<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ItemCatalogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('item_catalog')->delete();

        $records = [
            [
                'id' => 'C2OpLaSNgR0poaLripR3',
                'name' => 'Pistola .22LR',
                'category' => 'weapons',
                'rarity' => 'Common',
                'weight' => 0.4,
                'value' => 1200,
                'description' => 'Bonita né?! Mas é uma 22, os projeteis tem 5.5mm e a potência não é das melhores, mas mata... é mata.',
                'image' => 'https://sapesca.signacommerce.com.br/media/catalog/product/p/i/pistola-taurus-tx22-calibre-22-lr_3_1200.jpg',
                'image_path' => 'images/item_catalog/C2OpLaSNgR0poaLripR3_pistola_22lr.jpg',
                'stats' => '{"cor":-1}',
                'damage' => '1D8 + 1',
                'defense' => 0,
                'created_by' => 'Mestre',
                'created_at' => '2026-04-23T07:50:30.425Z',
                'updated_at' => '2026-11-03T10:25:53.044Z'
            ],
            [
                'id' => 'Nu6EjCdjqaZVFBfa81WW',
                'name' => 'Revólver .357 Magnum',
                'category' => 'weapons',
                'rarity' => 'Uncommon',
                'weight' => 0.8,
                'value' => 2000,
                'description' => null,
                'image' => 'https://armas.beartac.com.br/wp-content/uploads/2024/02/Revolver-Taurus-38-RT856-3-6-Tiros-OX-FOSCO-2.jpg',
                'image_path' => 'images/item_catalog/Nu6EjCdjqaZVFBfa81WW_revolver_357_magnum.jpg',
                'stats' => 'Dano: 1d6 + 3',
                'damage' => '1d8 + 3',
                'defense' => 0,
                'created_by' => 'Mestre',
                'created_at' => '2026-04-20T13:27:54.511Z',
                'updated_at' => '2026-11-03T10:25:53.044Z'
            ],
            [
                'id' => 'escudo',
                'name' => 'Escudo de Madeira Pequeno',
                'category' => 'armor',
                'rarity' => 'Comum',
                'weight' => 1,
                'value' => 200,
                'description' => null,
                'image' => 'https://picsum.photos/seed/Escudo/100/100',
                'image_path' => 'images/item_catalog/escudo_escudo_de_madeira_pequeno.jpg',
                'stats' => 'Defesa: +10',
                'damage' => null,
                'defense' => 10,
                'created_by' => 'Gideon Windrider',
                'created_at' => '2026-11-03T10:25:53.044Z',
                'updated_at' => '2026-11-03T10:25:53.044Z'
            ],
            [
                'id' => 'lwpJu0Y1eCa5RhhZprt5',
                'name' => 'Munição .22LR',
                'category' => 'ammo',
                'rarity' => 'Common',
                'weight' => 0.02,
                'value' => 1,
                'description' => null,
                'image' => 'https://upload.wikimedia.org/wikipedia/commons/6/61/.22_LR.jpg',
                'image_path' => 'images/item_catalog/lwpJu0Y1eCa5RhhZprt5_municao_22lr.jpg',
                'stats' => '{}',
                'damage' => null,
                'defense' => 0,
                'created_by' => 'Mestre',
                'created_at' => '2026-04-23T07:55:19.476Z',
                'updated_at' => '2026-11-03T10:25:53.044Z'
            ],
            [
                'id' => 'revlver',
                'name' => 'Revólver .380',
                'category' => 'weapons',
                'rarity' => 'Common',
                'weight' => 0.6,
                'value' => 2000,
                'description' => null,
                'image' => 'https://armas.beartac.com.br/wp-content/uploads/2024/02/Revolver-Taurus-38-RT856-3-6-Tiros-OX-FOSCO-2.jpg',
                'image_path' => 'images/item_catalog/revlver_revolver_380.jpg',
                'stats' => 'Dano: 1d6 + 3',
                'damage' => '1d6 + 3',
                'defense' => 0,
                'created_by' => 'Gideon Windrider',
                'created_at' => '2026-11-03T10:25:53.044Z',
                'updated_at' => '2026-11-03T10:25:53.044Z'
            ],
            [
                'id' => 'xU3T1gTVNevMaAdh9qkF',
                'name' => 'Desert Eagle',
                'category' => 'Geral',
                'rarity' => 'Uncommon',
                'weight' => 1.5,
                'value' => 40000,
                'description' => null,
                'image' => 'https://i.ytimg.com/vi/jJEVXX_D8JI/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDNv8obyWKQFDqXT7gFxECSUpaHTg',
                'image_path' => 'images/item_catalog/xU3T1gTVNevMaAdh9qkF_desert_eagle.jpg',
                'stats' => '{"cor":2}',
                'damage' => '1D8 + 5',
                'defense' => 0,
                'created_by' => 'Mestre',
                'created_at' => '2026-04-20T10:28:07.561Z',
                'updated_at' => '2026-11-03T10:25:53.044Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('item_catalog')->insert($chunk);
        }
    }
}
