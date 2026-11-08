<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Enums\ViewMode;
use App\Models\CampaignMap;
use App\Models\Character;
use App\Models\DungeonFog;
use App\Models\GameSession;
use App\Models\GameSessionMap;
use App\Models\User;
use App\Support\Navigation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Fase 8b: Gerenciador de Mapas (mapas da campanha, ativação, camadas e névoa).
 */
class MapManagerTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    private CampaignMap $preset;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create();
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->preset = new CampaignMap(['type' => MapType::Dungeon, 'name' => 'Catacumbas de Exemplo', 'grid_cols' => 10, 'grid_rows' => 5, 'entrance_x' => 10, 'entrance_y' => 50]);
        $this->preset->forceFill(['preset_key' => 'exemplo'])->save();
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createMap(array $overrides = []): CampaignMap
    {
        $this->actingAs($this->gm)->post(route('map-manager.store', $this->session), [
            'type' => 'dungeon',
            'name' => 'Cripta Própria',
            'grid_cols' => 24,
            'grid_rows' => 14,
            'image' => UploadedFile::fake()->create('cripta.png', 50, 'image/png'),
            ...$overrides,
        ])->assertSessionHasNoErrors()->assertRedirect();

        return CampaignMap::query()->whereNull('preset_key')->latest('id')->firstOrFail();
    }

    public function test_gm_sees_the_campaign_maps(): void
    {
        $this->actingAs($this->gm)->get(route('map-manager.index'))
            ->assertOk()
            ->assertSee('Forja Cartográfica')
            ->assertSee('Catacumbas de Exemplo');

        // Jogadores não têm o recurso por padrão; o mestre no modo Jogador vê o aviso.
        $this->actingAs($this->player)->get(route('map-manager.index'))->assertForbidden();
        $this->actingAs($this->gm)->withSession([Navigation::SESSION_KEY => ViewMode::Player->value])
            ->get(route('map-manager.index'))
            ->assertOk()
            ->assertSee('Acesso Exclusivo para Mestres');
    }

    public function test_gm_creates_and_edits_custom_maps(): void
    {
        $map = $this->createMap();

        $this->assertSame($this->session->id, $map->game_session_id);
        $this->assertSame('Mapa tático de batalha', $map->subtitle);
        $this->assertSame(10.0, $map->entrance_x);
        Storage::disk('public')->assertExists($map->image_path);
        $oldImage = $map->image_path;

        $this->actingAs($this->gm)->put(route('map-manager.update', [$this->session, $map]), [
            'name' => 'Cripta Renomeada',
            'grid_cols' => 30,
            'grid_rows' => 20,
            'image' => UploadedFile::fake()->create('nova.png', 50, 'image/png'),
        ])->assertSessionHasNoErrors();

        $map->refresh();
        $this->assertSame('Cripta Renomeada', $map->name);
        $this->assertSame(30, $map->grid_cols);
        Storage::disk('public')->assertMissing($oldImage);
        // Sem a caixa "visível", o mapa fica oculto dos jogadores.
        $this->assertFalse($this->session->mapsOfType(MapType::Dungeon)->firstWhere('id', $map->id)->active_in_session);
    }

    public function test_world_maps_need_an_image(): void
    {
        $this->actingAs($this->gm)->post(route('map-manager.store', $this->session), ['type' => 'world', 'name' => 'Sem imagem'])
            ->assertSessionHasErrorsIn('createMap', ['image' => 'Envie a imagem do mapa.']);

        $map = $this->createMap(['type' => 'world', 'name' => 'Reino', 'grid_cols' => null, 'grid_rows' => null]);
        $this->assertSame('1 cm = 25 léguas', $map->default_scale);
        $this->assertNull($map->grid_cols);
    }

    public function test_presets_and_other_gms_maps_are_protected(): void
    {
        $map = $this->createMap();
        $otherGm = User::factory()->gm()->create();
        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT234']);
        $other->gm_id = $otherGm->id;
        $other->save();

        $this->actingAs($this->gm)->delete(route('map-manager.destroy', [$this->session, $this->preset]))->assertNotFound();
        $this->actingAs($otherGm)->delete(route('map-manager.destroy', [$other, $map]))->assertNotFound();
        $this->actingAs($otherGm)->post(route('map-manager.store', $this->session), ['type' => 'world', 'name' => 'X'])->assertForbidden();

        $this->actingAs($this->gm)->delete(route('map-manager.destroy', [$this->session, $map]))->assertRedirect();
        $this->assertModelMissing($map);
        Storage::disk('public')->assertMissing($map->image_path);
    }

    public function test_activation_is_per_campaign(): void
    {
        $this->actingAs($this->gm)->put(route('map-manager.active', [$this->session, $this->preset]), ['active' => 0])
            ->assertSessionHas('status');

        $this->assertFalse($this->session->mapsOfType(MapType::Dungeon)->first()->active_in_session);

        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT234']);
        $other->gm_id = $this->gm->id;
        $other->save();
        $this->assertTrue($other->mapsOfType(MapType::Dungeon)->first()->active_in_session);
    }

    public function test_layers_and_fog_are_saved(): void
    {
        $this->actingAs($this->gm)->get(route('map-manager.layers', [$this->session, $this->preset]))
            ->assertOk()
            ->assertSee('Névoa de guerra ativa');

        $this->actingAs($this->gm)->putJson(route('map-manager.layers.update', [$this->session, $this->preset]), [
            'layers' => [
                'show_background' => true, 'background_opacity' => 80, 'show_grid' => false, 'grid_opacity' => 40,
                'show_tokens' => true, 'fog_opacity' => 70, 'grid_scale' => ['unit' => 'm', 'value_per_square' => 1.5],
            ],
            'fog' => ['enabled' => true, 'revealed_cells' => [0, 1, 2, 2, 49]],
        ])->assertOk();

        $pivot = $this->session->maps()->whereKey($this->preset->id)->first()->pivot;
        $this->assertSame(80, $pivot->layer_settings['background_opacity']);
        $this->assertSame('m', $pivot->layer_settings['grid_scale']['unit']);

        $fog = DungeonFog::query()->sole();
        $this->assertTrue($fog->enabled);
        $this->assertSame([0, 1, 2, 49], $fog->revealed_cells);

        // A grade tem 10×5 = 50 células: índices maiores são recusados.
        $this->actingAs($this->gm)->putJson(route('map-manager.layers.update', [$this->session, $this->preset]), [
            'layers' => $pivot->layer_settings,
            'fog' => ['enabled' => true, 'revealed_cells' => [50]],
        ])->assertJsonValidationErrors('fog.revealed_cells.0');

        $this->actingAs($this->player)->getJson(route('map-manager.layers', [$this->session, $this->preset]))->assertForbidden();
    }

    public function test_imported_layer_settings_are_understood(): void
    {
        $layers = GameSessionMap::normalizeLayers(['showGrid' => false, 'gridOpacity' => 30, 'gridScale' => ['unit' => 'sq', 'valuePerSquare' => 2]]);

        $this->assertFalse($layers['show_grid']);
        $this->assertSame(30, $layers['grid_opacity']);
        $this->assertSame(['unit' => 'squares', 'value_per_square' => 2.0], $layers['grid_scale']);
        $this->assertSame(['enabled' => true, 'revealed_cells' => [3, 4]], $this->preset->fogIn($this->session, ['fogEnabled' => true, 'revealedCells' => [3, 4, 999]]));
    }

    public function test_sheet_lists_the_active_campaign_maps(): void
    {
        $hidden = $this->createMap(['name' => 'Covil Secreto']);
        $this->session->setMapActive($hidden, false);

        $character = new Character(['name' => 'Alden']);
        $character->user_id = $this->player->id;
        $character->game_session_id = $this->session->id;
        $character->save();

        $this->actingAs($this->player)->get(route('characters.show', $character))
            ->assertOk()
            ->assertSee('Mapas da Campanha')
            ->assertSee('<strong>Catacumbas de Exemplo</strong>', false)
            ->assertDontSee('<strong>Covil Secreto</strong>', false)
            ->assertSee('generic-dungeon-thumb.jpg', false);
    }

    public function test_sheet_hides_real_map_thumbnails_when_the_gm_plays_as_player(): void
    {
        $map = $this->createMap(['name' => 'Covil Revelado']);
        $hidden = $this->createMap(['name' => 'Covil Secreto']);
        $this->session->setMapActive($hidden, false);

        // Personagem do próprio mestre na campanha, aberto no modo Jogador.
        $character = new Character(['name' => 'Mestre Jogando']);
        $character->user_id = $this->gm->id;
        $character->game_session_id = $this->session->id;
        $character->save();

        $this->actingAs($this->gm)->withSession([Navigation::SESSION_KEY => ViewMode::Player->value])
            ->get(route('characters.show', $character))
            ->assertOk()
            ->assertSee('<strong>Covil Revelado</strong>', false)
            ->assertDontSee('<strong>Covil Secreto</strong>', false)
            ->assertDontSee($map->image_path, false)
            ->assertDontSee('oculto dos jogadores')
            ->assertSee('generic-dungeon-thumb.jpg', false);

        // No modo Mestre, a mesma ficha mostra a imagem real e os mapas ocultos.
        $this->actingAs($this->gm)->withSession([Navigation::SESSION_KEY => ViewMode::Gm->value])
            ->get(route('characters.show', $character))
            ->assertOk()
            ->assertSee($map->image_path, false)
            ->assertSee('<strong>Covil Secreto</strong>', false)
            ->assertSee('oculto dos jogadores');
    }
}
