<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Http\Controllers\DungeonTokenController;
use App\Models\CampaignMap;
use App\Models\Character;
use App\Models\DungeonFog;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\MapDrawing;
use App\Models\User;
use App\Support\BoardVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 9a: battlemap da masmorra (tokens, névoa, áreas, marcadores e combate).
 * Grade de teste: 10 × 5 células (cada célula = 10% × 20%).
 */
class DungeonTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    private CampaignMap $map;

    private Character $character;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create();
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->map = new CampaignMap(['type' => MapType::Dungeon, 'name' => 'Cripta de Exemplo', 'grid_cols' => 10, 'grid_rows' => 5, 'entrance_x' => 15, 'entrance_y' => 50]);
        $this->map->forceFill(['preset_key' => 'exemplo'])->save();

        $this->character = new Character(['name' => 'Alden', 'stats' => ['for' => 4, 'con' => 3, 'ini' => 2], 'current_pv' => 12]);
        $this->character->user_id = $this->player->id;
        $this->character->game_session_id = $this->session->id;
        $this->character->save();
    }

    private function url(string $name, array $extra = []): string
    {
        return route($name, [$this->session, $this->map, ...$extra]);
    }

    private function join(): array
    {
        return $this->actingAs($this->player)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'character', 'character_id' => $this->character->id])
            ->assertCreated()
            ->json('token');
    }

    public function test_page_and_state(): void
    {
        $this->actingAs($this->player)->get(route('dungeon.index'))
            ->assertOk()
            ->assertSee('Cripta de Exemplo')
            ->assertSee('js/dungeon/index.js', false);

        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))
            ->assertOk()
            ->assertJsonPath('changed', true)
            ->assertJsonPath('combat.in_combat', false);

        $this->actingAs(User::factory()->create())->getJson($this->url('dungeon.state'))->assertForbidden();
    }

    public function test_player_joins_with_own_character_once(): void
    {
        $token = $this->join();

        $this->assertSame('Alden', $token['name']);
        $this->assertSame('player', $token['type']);
        $this->assertTrue($token['mine']);
        $this->assertSame(15.0, (float) $token['x']);
        $this->assertSame(50.0, (float) $token['y']);
        $this->assertSame(12, $token['hp']);
        $this->assertTrue($token['initiative'] >= 3, 'Iniciativa = d20 + INI (2).');

        // Entrar de novo devolve o mesmo token.
        $this->actingAs($this->player)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'character', 'character_id' => $this->character->id])
            ->assertOk()
            ->assertJsonPath('token.id', $token['id']);

        // Jogadores não colocam criaturas.
        $this->actingAs($this->player)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'preset', 'preset' => 'goblin'])->assertForbidden();
    }

    public function test_movement_snaps_and_respects_ownership(): void
    {
        $token = $this->join();
        $goblin = $this->actingAs($this->gm)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'preset', 'preset' => 'goblin'])->json('token');

        $this->actingAs($this->player)->putJson($this->url('dungeon.tokens.update', ['token' => $token['id']]), ['x' => 33, 'y' => 71])
            ->assertOk()
            ->assertJsonPath('token.x', 35)
            ->assertJsonPath('token.y', 70);

        $this->actingAs($this->player)->putJson($this->url('dungeon.tokens.update', ['token' => $goblin['id']]), ['x' => 50])->assertForbidden();

        // O jogador não muda nome, PV máximo nem visibilidade do próprio token.
        $this->actingAs($this->player)->putJson($this->url('dungeon.tokens.update', ['token' => $token['id']]), ['hp' => 5, 'max_hp' => 999, 'name' => 'Trapaça', 'conditions' => ['poisoned']])
            ->assertJsonPath('token.hp', 5)
            ->assertJsonPath('token.name', 'Alden')
            ->assertJsonPath('token.conditions', ['poisoned']);

        // Tokens 2×2 encaixam no cruzamento das linhas e não saem do mapa.
        $this->assertSame(90.0, DungeonTokenController::snap(99, 10, 2));
        $this->assertSame(40.0, DungeonTokenController::snap(41, 10, 2));
    }

    public function test_hidden_and_fogged_creatures_are_not_sent_to_players(): void
    {
        $this->actingAs($this->gm)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'preset', 'preset' => 'orc', 'is_hidden' => true])->assertCreated();
        $this->actingAs($this->gm)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'preset', 'preset' => 'goblin', 'x' => 95, 'y' => 90])->assertCreated();
        $this->actingAs($this->gm)->putJson($this->url('dungeon.fog'), ['enabled' => true, 'revealed_cells' => [0, 1]])->assertOk();

        $this->actingAs($this->gm)->getJson($this->url('dungeon.state'))->assertJsonCount(2, 'tokens');
        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))->assertJsonCount(0, 'tokens');

        // Revelar a célula do goblin (coluna 9, linha 4 → 49) mostra o goblin.
        $this->actingAs($this->gm)->putJson($this->url('dungeon.fog'), ['enabled' => true, 'revealed_cells' => [49]])->assertOk();
        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))->assertJsonCount(1, 'tokens')->assertJsonPath('tokens.0.name', 'Goblin Espreitador');

        $this->actingAs($this->player)->putJson($this->url('dungeon.fog'), ['enabled' => false, 'revealed_cells' => []])->assertForbidden();
    }

    public function test_other_players_tokens_follow_the_fog_and_moves_reach_everyone(): void
    {
        $companion = User::factory()->create();
        $this->session->players()->attach($companion);
        $other = new Character(['name' => 'Brina', 'stats' => ['for' => 2], 'current_pv' => 8]);
        $other->user_id = $companion->id;
        $other->game_session_id = $this->session->id;
        $other->save();

        $mine = $this->join();
        $theirs = $this->actingAs($companion)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'character', 'character_id' => $other->id])->json('token');
        $before = $this->actingAs($this->player)->getJson($this->url('dungeon.state'))->assertJsonCount(2, 'tokens')->json('version');

        // Um movimento no mesmo segundo muda a versão e chega ao outro jogador.
        $this->actingAs($companion)->putJson($this->url('dungeon.tokens.update', ['token' => $theirs['id']]), ['x' => 25, 'y' => 50])->assertOk();
        $this->actingAs($this->player)->getJson($this->url('dungeon.state', ['versao' => $before]))
            ->assertJsonPath('changed', true)
            ->assertJsonPath('tokens.1.x', 25);

        // Com a névoa cobrindo o companheiro, só o próprio token chega.
        $this->actingAs($this->gm)->putJson($this->url('dungeon.fog'), ['enabled' => true, 'revealed_cells' => []])->assertOk();
        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))
            ->assertJsonCount(1, 'tokens')
            ->assertJsonPath('tokens.0.id', $mine['id']);
        $this->actingAs($this->gm)->getJson($this->url('dungeon.state'))->assertJsonCount(2, 'tokens');
    }

    public function test_gm_creatures_stay_in_the_fog_even_for_the_gm_in_player_mode(): void
    {
        $this->actingAs($this->gm)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'preset', 'preset' => 'goblin', 'x' => 95, 'y' => 90])->assertCreated();
        $this->actingAs($this->gm)->putJson($this->url('dungeon.fog'), ['enabled' => true, 'revealed_cells' => [0]])->assertOk();

        $this->actingAs($this->gm)->withSession(['view_mode' => 'user'])->getJson($this->url('dungeon.state'))->assertJsonCount(0, 'tokens');
    }

    public function test_state_stays_unchanged_until_the_board_changes(): void
    {
        $this->freezeTime();
        $token = $this->join();

        $version = fn (): string => $this->actingAs($this->player)->getJson($this->url('dungeon.state'))->json('version');
        $assertChanged = function (string $before, bool $changed): void {
            $this->actingAs($this->player)->getJson($this->url('dungeon.state', ['versao' => $before]))
                ->assertOk()
                ->assertJsonPath('changed', $changed);
        };

        // Nada mudou: a resposta curta só traz versão e pings.
        $before = $version();
        $assertChanged($before, false);

        // Cada tipo de escrita troca a versão, inclusive as exclusões em massa.
        $this->actingAs($this->player)->putJson($this->url('dungeon.tokens.update', ['token' => $token['id']]), ['x' => 25, 'y' => 50])->assertOk();
        $assertChanged($before, true);

        $before = $version();
        $this->actingAs($this->player)->postJson($this->url('dungeon.aoes.store'), ['type' => 'circle', 'color' => '#ef4444', 'x' => 30, 'y' => 40, 'radius_feet' => 10, 'rotation' => 0])->assertCreated();
        $assertChanged($before, true);

        $before = $version();
        $this->actingAs($this->gm)->deleteJson($this->url('dungeon.aoes.clear'))->assertOk();
        $assertChanged($before, true);

        $drawing = new MapDrawing(['points' => [[1, 1], [2, 2]], 'color' => '#ffffff']);
        $drawing->forceFill(['game_session_id' => $this->session->id, 'campaign_map_id' => $this->map->id, 'user_id' => $this->gm->id])->save();
        $before = $version();
        $this->actingAs($this->gm)->deleteJson(route('maps.drawings.clear', [$this->session, $this->map, 'todos' => 1]))->assertOk();
        $assertChanged($before, true);

        $before = $version();
        $this->actingAs($this->gm)->putJson($this->url('dungeon.fog'), ['enabled' => true, 'revealed_cells' => [0]])->assertOk();
        $assertChanged($before, true);

        // O retrato da ficha aparece no token.
        $before = $version();
        $this->character->forceFill(['image_path' => 'https://example.test/novo.png'])->save();
        $assertChanged($before, true);

        // Personagem excluído leva o token junto.
        $before = $version();
        $this->character->deleteWithFiles();
        $assertChanged($before, true);
        $this->assertSame(0, DungeonToken::query()->count());

        // Rede de segurança: depois da janela, tudo é reenviado mesmo sem escrita.
        $before = $version();
        $this->travel(BoardVersion::SAFETY_SECONDS)->seconds();
        $assertChanged($before, true);
    }

    public function test_tokens_show_the_current_portrait_and_link_the_sheet(): void
    {
        $token = $this->join();
        $this->assertSame(route('characters.show', $this->character), $token['sheet_url']);

        // O retrato trocado depois de entrar no mapa aparece no token.
        $this->character->forceFill(['image_path' => 'https://example.test/retrato.png'])->save();
        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))
            ->assertJsonPath('tokens.0.avatar_url', 'https://example.test/retrato.png');

        // NPC da campanha: o mestre abre a ficha; jogadores não.
        $npc = new Character(['name' => 'Taberneiro', 'stats' => ['for' => 1]]);
        $npc->user_id = $this->gm->id;
        $npc->game_session_id = $this->session->id;
        $npc->is_npc = true;
        $npc->save();
        $npcToken = $this->actingAs($this->gm)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'character', 'character_id' => $npc->id])
            ->assertCreated()
            ->assertJsonPath('token.type', 'npc')
            ->json('token');
        $this->assertNotNull($npcToken['sheet_url']);

        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))
            ->assertJsonPath('tokens.1.name', 'Taberneiro')
            ->assertJsonPath('tokens.1.sheet_url', null);
    }

    public function test_player_movement_reveals_fog_around(): void
    {
        $this->actingAs($this->gm)->putJson($this->url('dungeon.fog'), ['enabled' => true, 'revealed_cells' => []])->assertOk();
        $token = $this->join();

        // Entrou na célula (1, 2) → revela 5×5 ao redor, recortado pela grade.
        $cells = DungeonFog::query()->sole()->revealed_cells;
        $this->assertContains(21, $cells);
        $this->assertContains(0, $cells);
        $this->assertNotContains(4, $cells);

        $this->actingAs($this->player)->putJson($this->url('dungeon.tokens.update', ['token' => $token['id']]), ['x' => 95, 'y' => 10])->assertOk();
        $this->assertContains(9, DungeonFog::query()->sole()->revealed_cells);
    }

    public function test_combat_turns_are_shared(): void
    {
        $this->join();
        $this->actingAs($this->gm)->postJson($this->url('dungeon.tokens.store'), ['mode' => 'custom', 'name' => 'Lich', 'hp' => 50, 'type' => 'monster', 'size' => 2])->assertCreated();
        DungeonToken::query()->where('name', 'Alden')->update(['initiative' => 18]);
        DungeonToken::query()->where('name', 'Lich')->update(['initiative' => 9]);
        [$alden, $lich] = [DungeonToken::query()->where('name', 'Alden')->value('id'), DungeonToken::query()->where('name', 'Lich')->value('id')];

        $this->actingAs($this->player)->putJson($this->url('dungeon.combat'), ['action' => 'start'])->assertForbidden();

        $this->actingAs($this->gm)->putJson($this->url('dungeon.combat'), ['action' => 'start'])->assertJsonPath('combat.active_token_id', $alden);
        $this->actingAs($this->gm)->putJson($this->url('dungeon.combat'), ['action' => 'next'])->assertJsonPath('combat.active_token_id', $lich);
        $this->actingAs($this->gm)->putJson($this->url('dungeon.combat'), ['action' => 'next'])
            ->assertJsonPath('combat.active_token_id', $alden)
            ->assertJsonPath('combat.round', 2);

        // Todos veem o mesmo turno.
        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))
            ->assertJsonPath('combat.active_token_id', $alden)
            ->assertJsonPath('combat.round', 2);

        $this->actingAs($this->gm)->putJson($this->url('dungeon.combat'), ['action' => 'reset'])->assertJsonPath('combat.in_combat', false);
    }

    public function test_aoes_and_markers(): void
    {
        $aoe = $this->actingAs($this->player)->postJson($this->url('dungeon.aoes.store'), ['type' => 'cone', 'name' => 'Sopro', 'color' => '#f97316', 'x' => 30, 'y' => 40, 'radius_feet' => 30, 'rotation' => 90])
            ->assertCreated()
            ->json('id');
        $this->actingAs($this->player)->postJson($this->url('dungeon.aoes.store'), ['type' => 'hexagon', 'color' => 'red', 'x' => 1, 'y' => 1, 'radius_feet' => 1, 'rotation' => 0])
            ->assertJsonValidationErrors(['type', 'color', 'radius_feet']);

        $other = User::factory()->create();
        $this->session->players()->attach($other);
        $this->actingAs($other)->putJson($this->url('dungeon.aoes.update', ['aoe' => $aoe]), ['rotation' => 0])->assertForbidden();
        $this->actingAs($this->player)->putJson($this->url('dungeon.aoes.update', ['aoe' => $aoe]), ['rotation' => 180])->assertOk();

        $marker = $this->actingAs($this->player)->postJson($this->url('dungeon.markers.store'), ['label' => 'Alavanca', 'category' => 'trap', 'x' => 50, 'y' => 50])
            ->assertCreated()
            ->json('id');

        $this->actingAs($this->player)->getJson($this->url('dungeon.state'))
            ->assertJsonPath('aoes.0.rotation', 180)
            ->assertJsonPath('markers.0.label', 'Alavanca');

        $this->actingAs($other)->deleteJson($this->url('dungeon.markers.destroy', ['marker' => $marker]))->assertForbidden();
        $this->actingAs($this->gm)->deleteJson($this->url('dungeon.markers.destroy', ['marker' => $marker]))->assertOk();
        $this->actingAs($this->player)->deleteJson($this->url('dungeon.aoes.clear'))->assertForbidden();
        $this->actingAs($this->gm)->deleteJson($this->url('dungeon.aoes.clear'))->assertOk();
    }

    public function test_world_maps_are_not_battlemaps(): void
    {
        $world = new CampaignMap(['type' => MapType::World, 'name' => 'Continente']);
        $world->forceFill(['preset_key' => 'mundo'])->save();

        $this->actingAs($this->gm)->getJson(route('dungeon.state', [$this->session, $world]))->assertNotFound();
    }
}
