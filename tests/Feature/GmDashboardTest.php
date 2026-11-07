<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\DungeonToken;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 9b: Painel do Mestre (mesa, vida, progressão, NPCs, bestiário,
 * encontros, anotações e configurações).
 */
class GmDashboardTest extends TestCase
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
        $this->player = User::factory()->create(['email' => 'jogador@exemplo.com']);
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->map = new CampaignMap(['type' => MapType::Dungeon, 'name' => 'Cripta de Exemplo', 'grid_cols' => 10, 'grid_rows' => 5, 'entrance_x' => 15, 'entrance_y' => 50]);
        $this->map->forceFill(['preset_key' => 'exemplo'])->save();

        // PV máximo pela fórmula padrão: ((4 / 2) + 3) * 10 = 50.
        $this->character = new Character(['name' => 'Alden', 'level' => 2, 'stats' => ['for' => 4, 'con' => 3], 'current_pv' => 30, 'temp_pv' => 0]);
        $this->character->user_id = $this->player->id;
        $this->character->game_session_id = $this->session->id;
        $this->character->save();
    }

    private function route(string $name, array $extra = []): string
    {
        return route('gm.sessions.'.$name, [$this->session, ...$extra]);
    }

    private function npc(array $attributes = []): Character
    {
        $npc = new Character(['name' => 'Goblin', 'stats' => ['for' => 2, 'con' => 1], ...$attributes]);
        $npc->user_id = $this->gm->id;
        $npc->game_session_id = $this->session->id;
        $npc->is_npc = true;
        $npc->save();

        return $npc;
    }

    public function test_every_tab_renders_for_the_gm_only(): void
    {
        foreach (['mesa', 'bestiario', 'encontros', 'anotacoes', 'configuracoes'] as $tab) {
            $this->actingAs($this->gm)->get($this->route('show', ['aba' => $tab]))
                ->assertOk()
                ->assertSee('js/gm/index.js', false);
        }

        $this->actingAs($this->gm)->get($this->route('show'))->assertSee('Alden')->assertSee('30');
        $this->actingAs($this->gm)->get($this->route('show', ['aba' => 'bestiario']))->assertSee('Kobold Emboscador');
        $this->actingAs($this->player)->get($this->route('show'))->assertForbidden();
    }

    public function test_health_actions_follow_the_tracker_rules(): void
    {
        $url = $this->route('characters.health', [$this->character]);
        $act = fn (array $data) => $this->actingAs($this->gm)->putJson($url, $data)->assertOk();

        $act(['action' => 'temp', 'amount' => 5])->assertJsonPath('temp_pv', 5)->assertJsonPath('max_pv', 50);
        // O temporário absorve primeiro: 5 no temp e 3 no PV.
        $act(['action' => 'damage', 'amount' => 8])->assertJsonPath('temp_pv', 0)->assertJsonPath('current_pv', 27);
        $act(['action' => 'heal', 'amount' => 100])->assertJsonPath('current_pv', 50);
        $act(['action' => 'damage', 'amount' => 80])->assertJsonPath('current_pv', 0);
        // Descanso curto: +25% do máximo.
        $act(['action' => 'short_rest'])->assertJsonPath('current_pv', 13);
        $act(['action' => 'long_rest'])->assertJsonPath('current_pv', 50);

        $this->actingAs($this->gm)->putJson($url, ['action' => 'damage'])->assertStatus(422);
        $this->actingAs($this->player)->putJson($url, ['action' => 'heal', 'amount' => 1])->assertForbidden();

        $this->assertSame(50, (int) $this->character->fresh()->current_pv);
    }

    public function test_characters_of_other_campaigns_are_not_found(): void
    {
        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT234']);
        $other->gm_id = $this->gm->id;
        $other->save();

        $this->actingAs($this->gm)->putJson(route('gm.sessions.characters.health', [$other, $this->character]), ['action' => 'long_rest'])->assertNotFound();
    }

    public function test_level_points_and_xp(): void
    {
        $url = $this->route('characters.progress', [$this->character]);

        $this->actingAs($this->gm)->put($url, ['action' => 'level_up', 'amount' => 2])->assertRedirect();
        $character = $this->character->fresh();
        $this->assertSame(4, $character->level);
        $this->assertSame(20, (int) $character->attribute_points);
        $this->assertSame(10, (int) $character->skill_points);
        $this->assertSame(4, (int) $character->power_points);

        $this->actingAs($this->gm)->put($url, ['action' => 'points', 'type' => 'powers', 'amount' => -10])->assertRedirect();
        $this->assertSame(0, (int) $this->character->fresh()->power_points);

        $this->actingAs($this->gm)->put($url, ['action' => 'xp', 'amount' => 1500])->assertRedirect();
        $this->assertSame(1500, (int) $this->character->fresh()->xp);
        $this->actingAs($this->gm)->get($this->route('show'))->assertSee('Pronto para subir');

        $this->actingAs($this->player)->put($url, ['action' => 'xp', 'amount' => 10])->assertForbidden();
    }

    public function test_generate_npc_and_monster(): void
    {
        $this->actingAs($this->gm)->post($this->route('npcs.store'), [
            'name' => 'Taverneiro Bram',
            'level' => 1,
            'archetype' => 'common',
            'is_monster' => '0',
            'trait_count' => 0,
        ])->assertRedirect();

        $npc = Character::query()->where('name', 'Taverneiro Bram')->firstOrFail();
        $this->assertTrue($npc->is_npc);
        $this->assertFalse($npc->is_monster);
        $this->assertSame($this->gm->id, $npc->user_id);
        $this->assertSame($this->session->id, $npc->game_session_id);
        $this->assertSame(28, (int) array_sum($npc->stats));
        $this->assertTrue((int) $npc->current_pv > 0);

        $this->actingAs($this->gm)->post($this->route('npcs.store'), [
            'name' => 'Lorde da Cripta',
            'level' => 2,
            'archetype' => 'boss',
            'is_monster' => '1',
            'monster_type' => 'Morto-vivo',
            'danger_level' => 'Chefe',
            'monster_size' => 2,
            'trait_count' => 0,
            'map_id' => $this->map->id,
            'hidden' => '1',
        ])->assertRedirect();

        $boss = Character::query()->where('name', 'Lorde da Cripta')->firstOrFail();
        $this->assertTrue($boss->is_monster);
        $this->assertSame(2, $boss->monster_size);
        $this->assertSame('Morto-vivo (Chefe)', $boss->class);
        // PV reforçado guardado em stats.pv e usado como PV atual.
        $this->assertSame((int) $boss->stats['pv'], (int) $boss->current_pv);

        $token = DungeonToken::query()->where('character_id', $boss->id)->firstOrFail();
        $this->assertTrue((bool) $token->is_hidden);
        $this->assertSame((int) $boss->current_pv, (int) $token->max_hp);
        $this->assertSame('monster', $token->type instanceof \BackedEnum ? $token->type->value : $token->type);

        $this->actingAs($this->player)->post($this->route('npcs.store'), ['level' => 1, 'archetype' => 'common', 'trait_count' => 0])->assertForbidden();
    }

    public function test_toggle_monster_and_delete_only_npcs(): void
    {
        $npc = $this->npc();
        $this->actingAs($this->gm)->put($this->route('characters.monster', [$npc]))->assertRedirect();
        $this->assertTrue($npc->fresh()->is_monster);

        $this->actingAs($this->gm)->put($this->route('characters.monster', [$this->character]))->assertStatus(422);
        $this->actingAs($this->gm)->delete($this->route('characters.destroy', [$this->character]))->assertForbidden();

        $this->actingAs($this->gm)->delete($this->route('characters.destroy', [$npc]))->assertRedirect();
        $this->assertNull($npc->fresh());
        $this->assertNotNull($this->character->fresh());
    }

    public function test_spawn_character_to_dungeon(): void
    {
        $url = $this->route('characters.spawn', [$this->character]);

        $this->actingAs($this->gm)->postJson($url, ['map_id' => $this->map->id, 'hidden' => false])->assertCreated();
        $token = DungeonToken::query()->where('character_id', $this->character->id)->firstOrFail();
        // Token de jogador fica com o dono do personagem.
        $this->assertSame($this->player->id, $token->user_id);
        $this->assertSame(30, (int) $token->hp);
        $this->assertSame(50, (int) $token->max_hp);

        $this->actingAs($this->gm)->postJson($url, ['map_id' => $this->map->id])->assertStatus(422);

        $world = new CampaignMap(['type' => MapType::World, 'name' => 'Mundo']);
        $world->forceFill(['preset_key' => 'mundo'])->save();
        $this->actingAs($this->gm)->postJson($url, ['map_id' => $world->id])->assertNotFound();
    }

    public function test_bestiary_spawn_and_encounter(): void
    {
        $this->actingAs($this->gm)->postJson($this->route('bestiary.spawn'), [
            'map_id' => $this->map->id,
            'hidden' => true,
            'monsters' => [['id' => 'kobold_scout', 'count' => 3]],
        ])->assertCreated()->assertJsonPath('count', 3);

        $tokens = DungeonToken::query()->where('campaign_map_id', $this->map->id)->orderBy('id')->get();
        $this->assertSame(['Kobold Emboscador #1', 'Kobold Emboscador #2', 'Kobold Emboscador #3'], $tokens->pluck('name')->all());
        $this->assertTrue($tokens->every(static fn (DungeonToken $token): bool => (bool) $token->is_hidden && (int) $token->hp === 5));
        $this->assertSame(3, $tokens->pluck('x')->unique()->count());

        $this->actingAs($this->gm)->postJson($this->route('bestiary.spawn'), [
            'map_id' => $this->map->id,
            'monsters' => [['id' => 'nao_existe', 'count' => 1]],
        ])->assertStatus(422);
        $this->actingAs($this->gm)->postJson($this->route('bestiary.spawn'), [
            'map_id' => $this->map->id,
            'monsters' => [['id' => 'kobold_scout', 'count' => 20], ['id' => 'giant_rat', 'count' => 20]],
        ])->assertStatus(422);

        $encounter = $this->actingAs($this->gm)->getJson($this->route('encounter', ['ambiente' => 'dungeon', 'dificuldade' => 'Difícil', 'tatica' => 'swarm']))
            ->assertOk()
            ->assertJsonPath('difficulty', 'Difícil')
            ->assertJsonPath('budgets.party_size', 1)
            ->json();
        $this->assertNotSame([], $encounter['monsters']);
        $this->assertArrayHasKey('count', $encounter['monsters'][0]);

        $this->actingAs($this->player)->getJson($this->route('encounter', ['ambiente' => 'dungeon', 'dificuldade' => 'Médio', 'tatica' => 'solo']))->assertForbidden();
    }

    public function test_notes_settings_and_shop(): void
    {
        $item = CatalogItem::query()->forceCreate(['name' => 'Poção de Cura', 'category' => 'consumable', 'value' => 50]);

        $this->actingAs($this->gm)->put($this->route('notes'), ['gm_notes' => 'O duque é o vilão.'])->assertRedirect();
        $this->assertSame('O duque é o vilão.', $this->session->fresh()->gm_notes);

        $this->actingAs($this->gm)->put($this->route('update'), [
            'name' => 'Crônicas Renovadas',
            'description' => 'Uma nova era.',
            'active' => '0',
            'shop_enabled' => '1',
            'shop_items' => [$item->id],
        ])->assertRedirect();

        $session = $this->session->fresh();
        $this->assertSame('Crônicas Renovadas', $session->name);
        $this->assertFalse($session->active);
        $this->assertTrue($session->shop_enabled);
        $this->assertSame([$item->id], $session->shopItems()->pluck('catalog_items.id')->all());

        $this->actingAs($this->player)->put($this->route('notes'), ['gm_notes' => 'x'])->assertForbidden();
    }

    public function test_invite_and_remove_players(): void
    {
        $newcomer = User::factory()->create(['email' => 'novata@exemplo.com']);

        $this->actingAs($this->gm)->post($this->route('players.store'), ['email' => 'NOVATA@exemplo.com'])->assertSessionHasNoErrors();
        $this->assertTrue($this->session->hasPlayer($newcomer));

        $this->actingAs($this->gm)->post($this->route('players.store'), ['email' => 'ninguem@exemplo.com'])->assertSessionHasErrorsIn('invitePlayer', 'email');

        $this->actingAs($this->gm)->delete($this->route('players.destroy', [$newcomer]))->assertRedirect();
        $this->assertFalse($this->session->hasPlayer($newcomer));
    }

    public function test_delete_session_requires_its_name(): void
    {
        $this->actingAs($this->gm)->delete($this->route('destroy'), ['confirmation' => 'errado'])->assertSessionHasErrorsIn('deleteSession', 'confirmation');
        $this->assertNotNull($this->session->fresh());

        $this->actingAs($this->player)->delete($this->route('destroy'), ['confirmation' => 'Crônicas'])->assertForbidden();

        $this->actingAs($this->gm)->delete($this->route('destroy'), ['confirmation' => 'Crônicas'])->assertRedirect(route('dashboard'));
        $this->assertNull($this->session->fresh());
    }
}
