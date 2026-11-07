<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\CustomSound;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Models\User;
use App\Support\Sounds;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Fase 9c: sons das regras, biblioteca, ambientação da campanha, efeitos
 * "para a mesa" e clima da masmorra.
 */
class SoundBoardTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

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
    }

    private function sound(array $attributes = [], ?User $owner = null, bool $personal = false): CustomSound
    {
        $sound = new CustomSound(['name' => 'Porta da cripta', 'category' => 'dungeon', 'type' => 'sfx', 'source_type' => 'upload', 'path' => 'sounds/porta.mp3', ...$attributes]);
        $sound->user_id = ($owner ?? $this->gm)->id;
        $sound->game_session_id = $personal ? null : $this->session->id;
        $sound->save();

        return $sound;
    }

    private function assertNoErrors(): void
    {
        $errors = session('errors');
        $this->assertNull($errors, $errors === null ? '' : (string) json_encode(array_map(static fn ($bag) => $bag->all(), $errors->getBags()), JSON_UNESCAPED_UNICODE));
    }

    public function test_sounds_tab_and_ambience_tool_render(): void
    {
        $this->sound();

        $this->actingAs($this->gm)->get(route('gm.sessions.show', [$this->session, 'aba' => 'sons']))
            ->assertOk()
            ->assertSee('Golpe de Lâmina')
            ->assertSee('Porta da cripta')
            ->assertSee('js/tools/ambience.js', false);
    }

    public function test_effects_are_saved_in_campaign_rules(): void
    {
        RuleSet::query()->create(['pv_formula' => 'CON * 10']);
        $sound = $this->sound();

        $this->actingAs($this->gm)->put(route('gm.sessions.sounds.update', $this->session), [
            'sounds' => ['door' => 'sound:'.$sound->id, 'critical' => 'url', 'attack' => '', 'success' => 'synth:success'],
            'sound_urls' => ['critical' => 'https://exemplo.com/critico.mp3'],
            'also_global' => '1',
        ])->assertRedirect();
        $this->assertNoErrors();

        $campaign = $this->session->fresh()->ruleSet;
        $this->assertNotNull($campaign);
        // A campanha nasce como cópia das regras globais.
        $this->assertSame('CON * 10', $campaign->pv_formula);
        $this->assertSame('https://exemplo.com/critico.mp3', $campaign->critical_sound);
        $this->assertNull($campaign->success_sound);
        $this->assertSame('sound:'.$sound->id, $campaign->sound_settings['door']);

        $urls = Sounds::urls($campaign);
        $this->assertSame(Storage::disk('public')->url('sounds/porta.mp3'), $urls['door']);
        $this->assertNull($urls['attack']);

        // Só administradores mudam o padrão global.
        $this->assertNull(RuleSet::query()->global()->first()->critical_sound);
    }

    public function test_admin_can_also_save_global_sounds(): void
    {
        $admin = User::factory()->admin()->create();
        $this->session->gm_id = $admin->id;
        $this->session->save();

        $this->actingAs($admin)->put(route('gm.sessions.sounds.update', $this->session), [
            'sounds' => ['roll' => '', 'dice_roll' => 'url'],
            'sound_urls' => ['dice_roll' => 'https://exemplo.com/dados.mp3'],
            'also_global' => '1',
        ]);
        $this->assertNoErrors();

        $this->assertSame('https://exemplo.com/dados.mp3', RuleSet::query()->global()->first()->dice_roll_sound);
    }

    public function test_invalid_sounds_are_rejected(): void
    {
        $otherGm = User::factory()->gm()->create();
        $foreign = $this->sound([], $otherGm, true);

        $this->actingAs($this->gm)->put(route('gm.sessions.sounds.update', $this->session), ['sounds' => ['door' => 'sound:'.$foreign->id]])
            ->assertSessionHasErrorsIn('sounds', 'sounds.door');
        $this->actingAs($this->gm)->put(route('gm.sessions.sounds.update', $this->session), ['sounds' => ['door' => 'url'], 'sound_urls' => ['door' => 'javascript:alert(1)']])
            ->assertSessionHasErrorsIn('sounds', 'sounds.door');
        $this->actingAs($this->player)->put(route('gm.sessions.sounds.update', $this->session), ['sounds' => []])->assertForbidden();
    }

    public function test_library_upload_url_and_delete(): void
    {
        $this->actingAs($this->gm)->post(route('gm.sessions.sounds.store', $this->session), [
            'name' => 'Rugido do dragão',
            'category' => 'system',
            'scope' => 'personal',
            'file' => UploadedFile::fake()->create('rugido.mp3', 120, 'audio/mpeg'),
        ]);
        $this->assertNoErrors();

        $sound = CustomSound::query()->where('name', 'Rugido do dragão')->firstOrFail();
        $this->assertNull($sound->game_session_id);
        $this->assertSame('upload', $sound->source_type);
        Storage::disk('public')->assertExists($sound->path);

        $this->actingAs($this->gm)->post(route('gm.sessions.sounds.store', $this->session), [
            'name' => 'Taverna',
            'category' => 'ambient',
            'scope' => 'campaign',
            'url' => 'https://exemplo.com/taverna.ogg',
        ]);
        $this->assertNoErrors();
        $track = CustomSound::query()->where('name', 'Taverna')->firstOrFail();
        $this->assertSame('ambient', $track->type);
        $this->assertSame('OGG', $track->format);

        $this->actingAs($this->gm)->post(route('gm.sessions.sounds.store', $this->session), [
            'name' => 'Imagem', 'category' => 'combat', 'scope' => 'campaign', 'file' => UploadedFile::fake()->create('x.png', 10, 'image/png'),
        ])->assertSessionHasErrorsIn('library', 'file');

        // Outro mestre não remove sons pessoais alheios.
        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT234']);
        $other->gm_id = User::factory()->gm()->create()->id;
        $other->save();
        $this->actingAs($other->gm)->delete(route('gm.sessions.sounds.destroy', [$other, $sound]))->assertNotFound();

        $this->actingAs($this->gm)->delete(route('gm.sessions.sounds.destroy', [$this->session, $sound]))->assertRedirect();
        $this->assertNull($sound->fresh());
        Storage::disk('public')->assertMissing($sound->path);
    }

    public function test_campaign_ambience_and_table_effects(): void
    {
        $state = route('ambience.state', $this->session);

        $first = $this->actingAs($this->player)->getJson($state)->assertOk()->assertJsonPath('soundscape', null)->json();
        $this->actingAs($this->player)->getJson($state.'?versao='.$first['version'])->assertJsonPath('changed', false);
        $this->actingAs(User::factory()->create())->getJson($state)->assertForbidden();

        $this->actingAs($this->gm)->putJson(route('ambience.update', $this->session), ['soundscape' => 'tavern', 'volume' => 70])
            ->assertOk()->assertJsonPath('label', 'Taverna Aconchegante');
        $this->actingAs($this->player)->getJson($state)->assertJsonPath('soundscape', 'tavern')->assertJsonPath('volume', 70);

        $track = $this->sound(['name' => 'Chuva', 'category' => 'ambient', 'source_type' => 'url', 'path' => 'https://exemplo.com/chuva.mp3']);
        $this->actingAs($this->gm)->putJson(route('ambience.update', $this->session), ['soundscape' => 'custom', 'sound_id' => $track->id])
            ->assertOk()->assertJsonPath('track_url', 'https://exemplo.com/chuva.mp3');

        $foreign = $this->sound([], User::factory()->gm()->create(), true);
        $this->actingAs($this->gm)->putJson(route('ambience.update', $this->session), ['soundscape' => 'custom', 'sound_id' => $foreign->id])->assertStatus(422);
        $this->actingAs($this->player)->putJson(route('ambience.update', $this->session), ['soundscape' => 'none'])->assertForbidden();

        $before = $this->actingAs($this->player)->getJson($state)->json('version');
        $this->actingAs($this->gm)->postJson(route('ambience.effect', $this->session), ['effect' => 'monster_roar'])->assertOk();
        $after = $this->actingAs($this->player)->getJson($state.'?versao='.$before)
            ->assertJsonPath('changed', true)
            ->assertJsonPath('effect.key', 'monster_roar')
            ->assertJsonPath('effect.fresh', true)
            ->json();
        $this->assertTrue($after['effect']['at'] > 0);

        $this->actingAs($this->gm)->postJson(route('ambience.effect', $this->session), ['effect' => 'explosao'])->assertStatus(422);
        $this->actingAs($this->player)->postJson(route('ambience.effect', $this->session), ['effect' => 'door'])->assertForbidden();
    }

    public function test_dungeon_weather(): void
    {
        $map = new CampaignMap(['type' => MapType::Dungeon, 'name' => 'Cripta', 'grid_cols' => 10, 'grid_rows' => 5]);
        $map->forceFill(['preset_key' => 'exemplo'])->save();

        $this->actingAs($this->gm)->putJson(route('dungeon.weather', [$this->session, $map]), ['weather' => 'snow'])->assertOk();
        $this->actingAs($this->player)->getJson(route('dungeon.state', [$this->session, $map]))->assertJsonPath('weather', 'snow');

        $this->actingAs($this->player)->putJson(route('dungeon.weather', [$this->session, $map]), ['weather' => 'rain'])->assertForbidden();
        $this->actingAs($this->gm)->putJson(route('dungeon.weather', [$this->session, $map]), ['weather' => 'tornado'])->assertStatus(422);
    }
}
