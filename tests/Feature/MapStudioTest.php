<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\User;
use App\Support\AiHordeMapRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Fase 8c: Estúdio de Esboços e refino por IA gratuita (AI Horde simulado).
 */
class MapStudioTest extends TestCase
{
    use RefreshDatabase;

    /** PNG 1×1 em base64. */
    private const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private User $gm;

    private GameSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        config(['services.ai_horde.url' => 'https://horde.example/api/v2', 'services.ai_horde.api_key' => '0000000000', 'services.ai_horde.enabled' => true]);

        $this->gm = User::factory()->gm()->create();
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function renderData(array $overrides = []): array
    {
        return [
            'image' => self::IMAGE,
            'type' => 'dungeon',
            'theme' => 'crypt',
            'elements' => ['piso', 'agua', 'porta'],
            'prompt' => 'ancient elven ruins',
            'width' => 1280,
            'height' => 720,
            'fidelity' => 60,
            'follow_lines' => true,
            'variations' => 2,
            ...$overrides,
        ];
    }

    /** Estado do AI Horde simulado (os stubs do Http::fake não se sobrescrevem). */
    private bool $hordeDone = true;

    private bool $hordeFaulted = false;

    private ?array $hordeError = null;

    private function fakeHorde(bool $done = true): void
    {
        $this->hordeDone = $done;

        Http::fake(function (Request $request) {
            $url = $request->url();

            return match (true) {
                $this->hordeError !== null => Http::response($this->hordeError, 429),
                str_ends_with($url, '/generate/async') => Http::response(['id' => 'horde-123'], 202),
                str_contains($url, '/generate/check/') => Http::response(['done' => $this->hordeDone, 'faulted' => $this->hordeFaulted, 'is_possible' => true, 'queue_position' => 3, 'wait_time' => 90]),
                str_contains($url, '/generate/status/') => Http::response(['generations' => [['img' => 'https://r2.example/a.webp'], ['img' => 'https://r2.example/b.webp']]]),
                str_starts_with($url, 'https://r2.example/') => Http::response('WEBPDATA'),
                default => Http::response([], 404),
            };
        });
    }

    public function test_only_the_campaign_gm_opens_the_studio(): void
    {
        $this->actingAs($this->gm)->get(route('map-manager.studio', $this->session))
            ->assertOk()
            ->assertSee('Estúdio de Esboços')
            ->assertSee('js/sketch-studio/index.js', false);

        $this->actingAs(User::factory()->gm()->create())->get(route('map-manager.studio', $this->session))->assertForbidden();
        $this->actingAs(User::factory()->create())->get(route('map-manager.studio', $this->session))->assertForbidden();
    }

    public function test_dungeon_prompt_is_specific(): void
    {
        $prompt = (new AiHordeMapRenderer)->prompt('dungeon', 'crypt', ['piso', 'porta', 'desconhecido'], 'ancient <script> ruins');

        $this->assertStringStartsWith('top-down orthographic tabletop RPG battle map', $prompt);
        $this->assertStringContainsString('sarcophagi', $prompt);
        $this->assertStringContainsString('rooms and corridors, doors', $prompt);
        $this->assertStringContainsString('ancient  script  ruins', $prompt);
        $this->assertStringContainsString('### text, letters', $prompt);
        $this->assertStringContainsString('isometric', $prompt);

        $world = (new AiHordeMapRenderer)->prompt('world', 'parchment', ['montanhas'], '');
        $this->assertStringContainsString('aged parchment', $world);
        $this->assertStringNotContainsString('battle map', $world);
    }

    public function test_render_is_sent_and_followed_until_done(): void
    {
        $this->fakeHorde(done: false);

        $id = $this->actingAs($this->gm)->postJson(route('map-manager.studio.render', $this->session), $this->renderData())
            ->assertAccepted()
            ->json('id');

        Http::assertSent(static function (Request $request): bool {
            if (! str_ends_with($request->url(), '/generate/async')) {
                return false;
            }

            $params = $request['params'];

            return $request['source_processing'] === 'img2img'
                && $request['source_image'] === 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
                && $params['control_type'] === 'fakescribbles'
                && $params['width'] === 768 && $params['height'] === 448
                && $params['n'] === 2
                && $request->hasHeader('apikey', '0000000000');
        });

        $this->actingAs($this->gm)->getJson(route('map-manager.studio.status', [$this->session, $id]))
            ->assertOk()
            ->assertJson(['done' => false, 'queue_position' => 3]);

        $this->hordeDone = true;
        Cache::forget('map-render:'.$id.':check');

        $images = $this->actingAs($this->gm)->getJson(route('map-manager.studio.status', [$this->session, $id]))
            ->assertJson(['done' => true])
            ->json('images');

        $this->assertCount(2, $images);
        Storage::disk('public')->assertExists('maps/renders/'.$id.'-0.webp');

        // Outro mestre não enxerga o pedido.
        $other = User::factory()->gm()->create();
        $this->session->forceFill(['gm_id' => $other->id])->save();
        $this->actingAs($other)->getJson(route('map-manager.studio.status', [$this->session, $id]))->assertNotFound();
    }

    public function test_ai_variation_is_saved_as_a_campaign_map(): void
    {
        $this->fakeHorde();
        $id = $this->actingAs($this->gm)->postJson(route('map-manager.studio.render', $this->session), $this->renderData())->json('id');
        $this->actingAs($this->gm)->getJson(route('map-manager.studio.status', [$this->session, $id]))->assertJson(['done' => true]);

        $this->actingAs($this->gm)->post(route('map-manager.studio.save', $this->session), [
            'type' => 'dungeon',
            'name' => 'Cripta Forjada',
            'theme' => 'Cripta sombria',
            'grid_cols' => 24,
            'grid_rows' => 14,
            'render' => $id,
            'variation' => 1,
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('redirect', route('map-manager.index', ['campanha' => $this->session->id]));

        $map = CampaignMap::query()->sole();
        $this->assertSame(MapType::Dungeon, $map->type);
        $this->assertSame($this->session->id, $map->game_session_id);
        $this->assertSame(24, $map->grid_cols);
        $this->assertSame('WEBPDATA', Storage::disk('public')->get($map->image_path));
    }

    public function test_illustrated_map_is_saved_from_upload(): void
    {
        $this->actingAs($this->gm)->post(route('map-manager.studio.save', $this->session), [
            'type' => 'world',
            'name' => 'Reino Ilustrado',
            'image' => UploadedFile::fake()->create('mapa.webp', 100, 'image/webp'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $map = CampaignMap::query()->sole();
        $this->assertSame('1 cm = 25 léguas', $map->default_scale);
        $this->assertNull($map->grid_cols);
        Storage::disk('public')->assertExists($map->image_path);

        $this->actingAs($this->gm)->postJson(route('map-manager.studio.save', $this->session), ['type' => 'world', 'name' => 'Sem imagem'])
            ->assertJsonValidationErrors(['render', 'image']);
    }

    public function test_invalid_requests_and_horde_errors(): void
    {
        $this->actingAs($this->gm)->postJson(route('map-manager.studio.render', $this->session), $this->renderData(['image' => 'data:text/html;base64,PHNjcmlwdD4=']))
            ->assertJsonValidationErrors(['image' => 'A imagem do esboço é inválida.']);

        $this->fakeHorde();
        $this->hordeError = ['message' => 'Too many prompts'];

        $this->actingAs($this->gm)->postJson(route('map-manager.studio.render', $this->session), $this->renderData())
            ->assertStatus(502)
            ->assertJsonPath('message', 'O AI Horde recusou o pedido: Too many prompts');

        config(['services.ai_horde.enabled' => false]);
        $this->actingAs($this->gm)->postJson(route('map-manager.studio.render', $this->session), $this->renderData())->assertNotFound();
    }

    public function test_failed_generation_is_reported(): void
    {
        $this->fakeHorde(done: false);
        $id = $this->actingAs($this->gm)->postJson(route('map-manager.studio.render', $this->session), $this->renderData(['follow_lines' => false]))->json('id');

        $this->hordeFaulted = true;

        $this->actingAs($this->gm)->getJson(route('map-manager.studio.status', [$this->session, $id]))
            ->assertJson(['done' => true, 'failed' => true]);
    }
}
