<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Enums\ViewMode;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\MapDrawing;
use App\Models\MapPin;
use App\Models\MapPing;
use App\Models\User;
use App\Support\Navigation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 8a: Mapa do Mundo com marcadores, desenhos e sinais por campanha.
 */
class WorldMapTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    private CampaignMap $map;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create(['name' => 'Jogadora Exemplo']);
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->map = new CampaignMap(['type' => MapType::World, 'name' => 'Continente de Exemplo', 'image_path' => 'maps/presets/exemplo.jpg']);
        $this->map->forceFill(['preset_key' => 'exemplo'])->save();
    }

    private function url(string $name, array $extra = []): string
    {
        return route($name, [$this->session, $this->map, ...$extra]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function pinData(array $overrides = []): array
    {
        return [
            'title' => 'Cidadela de Exemplo',
            'category' => 'town',
            'danger_level' => 'safe',
            'status' => 'explored',
            'description' => 'Muralhas brancas.',
            'x' => 43.5,
            'y' => 11.2,
            ...$overrides,
        ];
    }

    public function test_page_shows_the_campaign_map(): void
    {
        $this->actingAs($this->player)->get(route('world-map.index'))
            ->assertOk()
            ->assertSee('Continente de Exemplo')
            ->assertSee('js/world-map/index.js', false);

        $this->actingAs(User::factory()->create())->get(route('world-map.index'))
            ->assertOk()
            ->assertSee('Você ainda não participa de nenhuma campanha');
    }

    public function test_players_only_see_active_maps(): void
    {
        $this->session->setMapActive($this->map, false);

        $this->actingAs($this->player)->get(route('world-map.index'))->assertSee('Nenhum Mapa do Mundo Ativo');
        $this->actingAs($this->player)->getJson($this->url('world-map.state'))->assertForbidden();

        // O mestre continua vendo e reativa pelo seletor.
        $this->actingAs($this->gm)->get(route('world-map.index'))->assertSee('Continente de Exemplo');
        $this->actingAs($this->player)->putJson($this->url('world-map.active'), ['active' => true])->assertForbidden();
        $this->actingAs($this->gm)->putJson($this->url('world-map.active'), ['active' => true])->assertOk();
        $this->actingAs($this->player)->getJson($this->url('world-map.state'))->assertOk();
    }

    public function test_maps_of_other_campaigns_are_not_reachable(): void
    {
        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT234']);
        $other->gm_id = $this->gm->id;
        $other->save();

        $foreign = new CampaignMap(['type' => MapType::World, 'name' => 'Segredo']);
        $foreign->game_session_id = $other->id;
        $foreign->save();

        $this->actingAs($this->gm)->getJson(route('world-map.state', [$this->session, $foreign]))->assertNotFound();
        $this->actingAs(User::factory()->create())->getJson($this->url('world-map.state'))->assertForbidden();
    }

    public function test_players_create_pins_without_gm_secrets(): void
    {
        $this->actingAs($this->player)->postJson($this->url('world-map.pins.store'), $this->pinData([
            'secrets' => 'Tentativa de segredo',
            'is_secret' => true,
            'custom_icon' => 'Castle',
        ]))->assertCreated()
            ->assertJsonPath('pin.icon', 'castle')
            ->assertJsonPath('pin.discovered_by', 'Jogadora Exemplo')
            ->assertJsonPath('pin.can_edit', true);

        $pin = MapPin::query()->sole();
        $this->assertNull($pin->secrets);
        $this->assertFalse($pin->is_secret);
        $this->assertSame($this->player->id, $pin->created_by);

        $this->actingAs($this->player)->postJson($this->url('world-map.pins.store'), $this->pinData(['title' => '', 'category' => 'lua']))
            ->assertJsonValidationErrors(['title', 'category']);
    }

    public function test_secret_pins_and_notes_only_reach_the_gm(): void
    {
        $this->actingAs($this->gm)->postJson($this->url('world-map.pins.store'), $this->pinData(['title' => 'Covil oculto', 'is_secret' => true, 'secrets' => 'Um dragão dorme aqui.']))->assertCreated();
        $this->actingAs($this->gm)->postJson($this->url('world-map.pins.store'), $this->pinData(['title' => 'Taverna', 'secrets' => 'O dono é espião.']))->assertCreated();

        $this->actingAs($this->gm)->getJson($this->url('world-map.state'))
            ->assertJsonCount(2, 'pins')
            ->assertJsonPath('pins.1.secrets', 'O dono é espião.');

        $this->actingAs($this->player)->getJson($this->url('world-map.state'))
            ->assertJsonCount(1, 'pins')
            ->assertJsonPath('pins.0.title', 'Taverna')
            ->assertJsonPath('pins.0.secrets', null)
            ->assertJsonPath('pins.0.can_edit', false);

        // No modo Jogador, o mestre vê o mapa como jogador.
        $this->actingAs($this->gm)->withSession([Navigation::SESSION_KEY => ViewMode::Player->value])
            ->getJson($this->url('world-map.state'))
            ->assertJsonCount(1, 'pins');
    }

    public function test_only_author_or_gm_change_pins(): void
    {
        $pin = $this->actingAs($this->player)->postJson($this->url('world-map.pins.store'), $this->pinData())->json('pin');
        $intruder = User::factory()->create();
        $this->session->players()->attach($intruder);

        $this->actingAs($intruder)->putJson($this->url('world-map.pins.update', ['pin' => $pin['id']]), $this->pinData(['title' => 'Invadido']))->assertForbidden();
        $this->actingAs($this->gm)->putJson($this->url('world-map.pins.update', ['pin' => $pin['id']]), $this->pinData(['title' => 'Cidadela Real']))
            ->assertOk()
            ->assertJsonPath('pin.title', 'Cidadela Real');
        $this->actingAs($this->player)->deleteJson($this->url('world-map.pins.destroy', ['pin' => $pin['id']]))->assertOk();

        $this->assertSame(0, MapPin::query()->count());
    }

    public function test_state_is_only_resent_when_it_changes(): void
    {
        $version = $this->actingAs($this->player)->getJson($this->url('world-map.state'))
            ->assertJsonPath('changed', true)
            ->json('version');

        $this->actingAs($this->player)->getJson($this->url('world-map.state', ['versao' => $version]))
            ->assertJsonPath('changed', false)
            ->assertJsonMissingPath('pins');

        $this->actingAs($this->gm)->postJson($this->url('world-map.pins.store'), $this->pinData())->assertCreated();

        $this->actingAs($this->player)->getJson($this->url('world-map.state', ['versao' => $version]))
            ->assertJsonPath('changed', true)
            ->assertJsonCount(1, 'pins');
    }

    public function test_drawings_belong_to_their_author(): void
    {
        $stroke = ['points' => [['x' => 10, 'y' => 10], ['x' => 20, 'y' => 25]], 'color' => '#38bdf8', 'size' => 4];

        $id = $this->actingAs($this->player)->postJson($this->url('maps.drawings.store'), $stroke)
            ->assertCreated()
            ->assertJsonPath('drawing.mine', true)
            ->json('drawing.id');
        $this->actingAs($this->gm)->postJson($this->url('maps.drawings.store'), $stroke)->assertCreated();

        $this->actingAs($this->player)->postJson($this->url('maps.drawings.store'), [...$stroke, 'color' => 'red'])->assertJsonValidationErrors('color');

        $other = User::factory()->create();
        $this->session->players()->attach($other);
        $this->actingAs($other)->deleteJson($this->url('maps.drawings.destroy', ['drawing' => $id]))->assertForbidden();

        // Limpar os próprios não apaga os do mestre; limpar todos é só do mestre.
        $this->actingAs($this->player)->deleteJson($this->url('maps.drawings.clear'))->assertOk();
        $this->assertSame(1, MapDrawing::query()->count());
        $this->actingAs($this->player)->deleteJson($this->url('maps.drawings.clear').'?todos=1')->assertForbidden();
        $this->actingAs($this->gm)->deleteJson($this->url('maps.drawings.clear').'?todos=1')->assertOk();
        $this->assertSame(0, MapDrawing::query()->count());
    }

    public function test_pings_are_shared_for_a_few_seconds(): void
    {
        $this->actingAs($this->gm)->postJson($this->url('maps.pings.store'), ['x' => 50, 'y' => 40])
            ->assertCreated()
            ->assertJsonPath('ping.color', '#f59e0b');
        $this->actingAs($this->player)->postJson($this->url('maps.pings.store'), ['x' => 10, 'y' => 10])
            ->assertJsonPath('ping.color', '#38bdf8');

        $this->actingAs($this->player)->getJson($this->url('world-map.state'))->assertJsonCount(2, 'pings');

        MapPing::query()->update(['created_at' => now()->subMinute()]);
        $this->actingAs($this->player)->getJson($this->url('world-map.state'))->assertJsonCount(0, 'pings');
    }
}
