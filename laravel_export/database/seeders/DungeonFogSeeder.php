<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DungeonFogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('dungeon_fog')->delete();

        $records = [
            [
                'id' => 'dungeon_catacombs',
                'dungeon_id' => 'dungeon_catacombs',
                'enabled' => true,
                'revealed_cells' => '[75,99,121,122,123,124,146,147,148,170,171,172,2,26,76,100,125,145,169,193,194,195,149,173,196,197,218,219,220,242,243,244,217,221,241,245,265,266,267,268,269,288,289,312,313,290,314,126,150,174,127,151,175,291,292,315,316,293,317,270,294,318,271,295,319,272,296,320,273,297,321,246,247,198,199,4,5,6,28,29,30,0,1,24,25,3,27,152,153,154,176,177,178,200,201,202,156,157,158,180,181,182,204,205,206,51,52,53,48,49,50,281,282,283,305,306,307,329,330,331,129,130,131,155,179,128,103,104,105,79,80,81,55,56,57,120,144,168,192]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-10T08:37:36.714Z'
            ],
            [
                'id' => 'session_ANDyGPCgYgQZY0EZYxmw_catacombs',
                'dungeon_id' => 'session_ANDyGPCgYgQZY0EZYxmw_catacombs',
                'enabled' => true,
                'revealed_cells' => '[73,74,75,97,98,99,121,122,123,145,146,147,169,170,171,148,172,194,195,196]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-13T19:41:07.976Z'
            ],
            [
                'id' => 'session_ANDyGPCgYgQZY0EZYxmw_cavern',
                'dungeon_id' => 'session_ANDyGPCgYgQZY0EZYxmw_cavern',
                'enabled' => true,
                'revealed_cells' => '[241,242,243,265,266,267,289,290,291]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-10T09:01:06.302Z'
            ],
            [
                'id' => 'session_ANDyGPCgYgQZY0EZYxmw_knOfHDQFG7EHnah7jX3K',
                'dungeon_id' => 'session_ANDyGPCgYgQZY0EZYxmw_knOfHDQFG7EHnah7jX3K',
                'enabled' => true,
                'revealed_cells' => '[265,266,267,289,290,291,313,314,315]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-31T18:41:43.129Z'
            ],
            [
                'id' => 'session_ANDyGPCgYgQZY0EZYxmw_none',
                'dungeon_id' => 'session_ANDyGPCgYgQZY0EZYxmw_none',
                'enabled' => true,
                'revealed_cells' => '[145,146,147,169,170,171,193,194,195]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-19T10:45:45.544Z'
            ],
            [
                'id' => 'session_ANDyGPCgYgQZY0EZYxmw_temple',
                'dungeon_id' => 'session_ANDyGPCgYgQZY0EZYxmw_temple',
                'enabled' => true,
                'revealed_cells' => '[275,276,277,299,300,301,323,324,325]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-10T09:01:03.524Z'
            ],
            [
                'id' => 'session_ANDyGPCgYgQZY0EZYxmw_whtfN1bHCrfKhNPAcNd2',
                'dungeon_id' => 'session_ANDyGPCgYgQZY0EZYxmw_whtfN1bHCrfKhNPAcNd2',
                'enabled' => true,
                'revealed_cells' => '[145,146,147,169,170,171,193,194,195]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-22T16:17:44.839Z'
            ],
            [
                'id' => 'session_Qch0sz6SKD8oVXZ9oMIo_whtfN1bHCrfKhNPAcNd2',
                'dungeon_id' => 'session_Qch0sz6SKD8oVXZ9oMIo_whtfN1bHCrfKhNPAcNd2',
                'enabled' => true,
                'revealed_cells' => '[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-22T16:17:36.605Z'
            ],
            [
                'id' => 'session_Vceq7qnas0cVnPooYvRc_catacombs',
                'dungeon_id' => 'session_Vceq7qnas0cVnPooYvRc_catacombs',
                'enabled' => true,
                'revealed_cells' => '[73,74,75,97,98,99,121,122,123,145,146,147,169,170,171,124,148,172,194,195,196,218,219,220,193,217,168,192,216,173,197,221,242,243,244,266,267,268,120,144,96,290,291,292,314,315,316,269,293,317,270,294,318,271,295,319,272,296,320,273,297,321,246,247,248,222,223,224,198,199,200,174,175,176,150,151,152,126,127,128,125,149,129,153,177,130,154,178,131,155,179,132,156,180,106,107,108,82,83,84,58,59,60,34,35,36,10,11,12,133,157,181,134,158,182,135,159,183,136,160,184,137,161,185,138,162,186,139,163,187,203,204,205,227,228,229,251,252,253,275,276,277,230,254,278,299,300,301,323,324,325,302,326,255,279,303,250,274,298,226,231]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-23T09:54:58.083Z'
            ],
            [
                'id' => 'session_Vceq7qnas0cVnPooYvRc_cavern',
                'dungeon_id' => 'session_Vceq7qnas0cVnPooYvRc_cavern',
                'enabled' => true,
                'revealed_cells' => '[241,242,243,265,266,267,289,290,291]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-20T12:16:15.750Z'
            ],
            [
                'id' => 'session_Vceq7qnas0cVnPooYvRc_none',
                'dungeon_id' => 'session_Vceq7qnas0cVnPooYvRc_none',
                'enabled' => true,
                'revealed_cells' => '[145,146,147,169,170,171,193,194,195]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-20T11:57:52.481Z'
            ],
            [
                'id' => 'session_Vceq7qnas0cVnPooYvRc_temple',
                'dungeon_id' => 'session_Vceq7qnas0cVnPooYvRc_temple',
                'enabled' => true,
                'revealed_cells' => '[275,276,277,299,300,301,323,324,325]',
                'created_at' => '2026-11-03T10:25:53.046Z',
                'updated_at' => '2026-10-20T12:16:19.562Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('dungeon_fog')->insert($chunk);
        }
    }
}
