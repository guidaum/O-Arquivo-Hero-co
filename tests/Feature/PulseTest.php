<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\MapType;
use App\Models\CampaignMap;
use App\Models\GameSession;
use App\Models\User;
use App\Support\Pulse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Pulso do tempo real: a rota /pulso responde sem sessão nem banco, e cada
 * gravação troca a senha do canal, para o navegador só buscar o completo
 * (com banco) quando algo mudou. A hospedagem limita as conexões por hora.
 */
class PulseTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create(['name' => 'Mestre Exemplo']);
        $this->player = User::factory()->create(['name' => 'Jogadora Exemplo']);
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);
    }

    /**
     * @return array<string, string>
     */
    private function pulse(string ...$signed): array
    {
        $query = implode('&', array_map(static fn (string $channel): string => 'c[]='.urlencode($channel), $signed));

        return $this->get('/pulso?'.$query)->assertOk()->json('tokens');
    }

    public function test_pulse_answers_signed_channels_without_session_or_database(): void
    {
        $channel = Pulse::sign(Pulse::chat($this->session->id));
        $forged = Pulse::chat($this->session->id).'.assinatura-falsa';

        DB::enableQueryLog();
        $response = $this->get('/pulso?c[]='.urlencode($channel).'&c[]='.urlencode($forged))->assertOk();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([], $queries);
        $this->assertSame([$channel], array_keys($response->json('tokens')));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertSame('no-cache', $response->headers->get('X-LiteSpeed-Cache-Control'));
        $response->assertCookieMissing(config('session.cookie'));
    }

    public function test_chat_message_and_mentions_change_their_pulses(): void
    {
        $chat = $this->actingAs($this->player)->getJson(route('chat.index', $this->session))->assertOk()->json('pulse');
        $bell = $this->actingAs($this->gm)->getJson(route('notifications.index'))->assertOk()->json('pulse');

        $this->assertSame($chat['token'], $this->pulse($chat['channel'])[$chat['channel']]);

        $this->actingAs($this->player)->postJson(route('chat.store', $this->session), ['text' => 'Olá @Mestre'])->assertCreated();

        $tokens = $this->pulse($chat['channel'], $bell['channel']);
        $this->assertNotSame($chat['token'], $tokens[$chat['channel']]);
        $this->assertNotSame($bell['token'], $tokens[$bell['channel']]);
    }

    public function test_board_writes_and_pings_change_the_map_pulse(): void
    {
        $map = new CampaignMap(['type' => MapType::World, 'name' => 'Mundo de Exemplo']);
        $map->forceFill(['preset_key' => 'exemplo', 'active' => true])->save();
        $url = static fn (string $name, GameSession $session) => route($name, [$session, $map]);

        $state = $this->actingAs($this->player)->getJson($url('world-map.state', $this->session))->assertOk()->json('pulse');

        $this->actingAs($this->player)->postJson($url('maps.pings.store', $this->session), ['x' => 10, 'y' => 20])->assertCreated();
        $afterPing = $this->pulse($state['channel'])[$state['channel']];
        $this->assertNotSame($state['token'], $afterPing);

        // Ativar/ocultar o mapa também avisa quem está nele.
        $this->session->setMapActive($map, false);
        $this->assertNotSame($afterPing, $this->pulse($state['channel'])[$state['channel']]);
    }

    public function test_pulse_url_is_published_for_the_transport(): void
    {
        $this->actingAs($this->player)->get('/')
            ->assertOk()
            ->assertSee('<meta name="pulse-url" content="'.route('pulse').'">', false);
    }
}
