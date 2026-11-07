<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Character;
use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Fase 7: campanhas (criar e entrar pelo código), chat por polling,
 * rolagens enviadas ao chat e notificações de menções.
 */
class SessionChatTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    private Character $character;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->gm = User::factory()->gm()->create(['name' => 'Mestre Exemplo']);
        $this->player = User::factory()->create(['name' => 'Jogadora Exemplo']);
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->character = new Character(['name' => 'Alden Bravo', 'stats' => ['for' => 5], 'stats_mods' => ['for' => 2]]);
        $this->character->user_id = $this->player->id;
        $this->character->game_session_id = $this->session->id;
        $this->character->save();
    }

    // Campanhas

    public function test_gm_creates_a_campaign_with_an_invite_code(): void
    {
        $this->actingAs($this->gm)->post(route('sessions.store'), ['name' => 'A Cripta'])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $created = GameSession::query()->where('name', 'A Cripta')->firstOrFail();
        $this->assertSame($this->gm->id, $created->gm_id);
        $this->assertTrue($created->active);
        $this->assertMatchesRegularExpression('/^[A-Z2-9]{6}$/', $created->code);

        $this->actingAs($this->gm)->get(route('gm.sessions.show', $created))
            ->assertOk()
            ->assertSee($created->code)
            ->assertSee('Chat da Sessão');

        $this->actingAs($this->player)->post(route('sessions.store'), ['name' => 'Golpe'])->assertForbidden();
    }

    public function test_players_join_with_the_code(): void
    {
        $newcomer = User::factory()->create();

        $this->actingAs($newcomer)->from('/')->post(route('sessions.join'), ['code' => 'crn234'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status');
        $this->assertTrue($this->session->hasPlayer($newcomer));

        $this->actingAs($newcomer)->from('/')->post(route('sessions.join'), ['code' => 'CRN234'])
            ->assertSessionHasErrorsIn('joinSession', ['code' => 'Você já participa desta campanha.']);
        $this->actingAs($this->gm)->from('/')->post(route('sessions.join'), ['code' => 'CRN234'])
            ->assertSessionHasErrorsIn('joinSession', ['code' => 'Você é o mestre desta sessão.']);
        $this->actingAs($newcomer)->from('/')->post(route('sessions.join'), ['code' => 'NADA00'])
            ->assertSessionHasErrorsIn('joinSession', ['code' => 'Código de sessão inválido.']);

        $this->session->forceFill(['active' => false])->save();
        $this->actingAs(User::factory()->create())->from('/')->post(route('sessions.join'), ['code' => 'CRN234'])
            ->assertSessionHasErrorsIn('joinSession', ['code' => 'Código de sessão inválido.']);
    }

    public function test_player_campaign_card_opens_the_character_sheet(): void
    {
        $this->actingAs($this->player)->get('/')
            ->assertOk()
            ->assertSee(route('characters.show', $this->character), false)
            ->assertSee('Entrar em Campanha');
    }

    // Chat

    public function test_only_participants_read_the_chat(): void
    {
        $this->actingAs(User::factory()->create())->getJson(route('chat.index', $this->session))->assertForbidden();
        $this->actingAs($this->player)->getJson(route('chat.index', $this->session))->assertOk()->assertJson(['messages' => [], 'cursor' => 0]);
        $this->actingAs($this->gm)->getJson(route('chat.index', $this->session))->assertOk();
    }

    public function test_polling_returns_only_new_messages(): void
    {
        $first = ChatMessage::post($this->session, $this->gm, 'Mestre', ['text' => 'Bem-vindos']);
        $second = ChatMessage::post($this->session, $this->player, 'Alden', ['text' => 'Olá']);

        $this->actingAs($this->player)->getJson(route('chat.index', $this->session))
            ->assertJsonCount(2, 'messages')
            ->assertJsonPath('cursor', $second->id)
            ->assertJsonPath('messages.0.mine', false)
            ->assertJsonPath('messages.1.mine', true);

        $this->actingAs($this->player)->getJson(route('chat.index', ['gameSession' => $this->session, 'depois' => $first->id]))
            ->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.text', 'Olá');
    }

    public function test_mentions_are_stored_and_notify(): void
    {
        $this->actingAs($this->player)->postJson(route('chat.store', $this->session), [
            'text' => 'Cuidado @GM, e @AldenBravo também!',
            'character_id' => $this->character->id,
        ])->assertCreated()->assertJsonPath('message.sender_name', 'Alden Bravo');

        $message = ChatMessage::query()->latest('id')->firstOrFail();
        $this->assertTrue($message->should_notify);
        // A própria jogadora (dona de Alden) não é notificada por citar o próprio personagem.
        $this->assertSame([$this->gm->id], $message->mentions()->pluck('users.id')->all());

        $this->actingAs($this->gm)->getJson(route('notifications.index'))
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('items.0.sender_name', 'Alden Bravo')
            ->assertJsonPath('items.0.url', route('gm.sessions.show', ['gameSession' => $this->session, 'chat' => 1]));

        $this->actingAs($this->gm)->postJson(route('notifications.read'))->assertOk();
        $this->actingAs($this->gm)->getJson(route('notifications.index'))->assertJsonPath('unread', 0)->assertJsonCount(1, 'items');
    }

    public function test_roll_command_uses_the_character_attributes(): void
    {
        $this->actingAs($this->player)->postJson(route('chat.store', $this->session), [
            'text' => '/r 1d1 + FOR',
            'character_id' => $this->character->id,
        ])->assertCreated()
            ->assertJsonPath('message.type', 'roll')
            ->assertJsonPath('message.roll.total', 8)
            ->assertJsonPath('message.text', 'Rolou: 1d1 + FOR');
    }

    public function test_cannot_speak_as_someone_elses_character(): void
    {
        $this->actingAs($this->gm)->postJson(route('chat.store', $this->session), [
            'text' => 'Sou o Alden!',
            'character_id' => $this->character->id,
        ])->assertCreated()->assertJsonPath('message.sender_name', 'Mestre Exemplo');
    }

    public function test_empty_messages_are_rejected(): void
    {
        $this->actingAs($this->player)->postJson(route('chat.store', $this->session), ['text' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['text' => 'Escreva uma mensagem ou anexe uma imagem.']);
    }

    public function test_gm_clears_the_chat_and_its_images(): void
    {
        $this->actingAs($this->player)->post(route('chat.store', $this->session), [
            'image' => UploadedFile::fake()->create('mapa.png', 10, 'image/png'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $path = ChatMessage::query()->value('image_path');
        Storage::disk('public')->assertExists($path);

        $this->actingAs($this->player)->deleteJson(route('chat.clear', $this->session))->assertForbidden();
        $this->actingAs($this->gm)->deleteJson(route('chat.clear', $this->session))->assertOk();

        $this->assertSame(0, ChatMessage::query()->count());
        Storage::disk('public')->assertMissing($path);
        $this->assertNotNull($this->session->fresh()->chat_cleared_at);
    }

    // Rolagens das outras telas

    public function test_sheet_tests_are_posted_to_the_campaign_chat(): void
    {
        $this->actingAs($this->player)->post(route('characters.test', $this->character), ['target' => 'attr:for', 'difficulty' => 'normal'])
            ->assertRedirect();

        $message = ChatMessage::query()->sole();
        $this->assertSame(ChatMessage::TYPE_ROLL, $message->type);
        $this->assertSame('Alden Bravo', $message->sender_name);
        $this->assertStringStartsWith('Rolou Força [Normal]: ', $message->text);
        $this->assertIsBool($message->roll_data['success']);
    }

    public function test_item_damage_rolls_are_posted_to_the_campaign_chat(): void
    {
        $item = $this->character->items()->create(['name' => 'Adaga', 'category' => 'weapons', 'damage' => '1d1 + FOR', 'quantity' => 1]);

        $this->actingAs($this->player)->post(route('inventory.items.roll', [$this->character, $item]))->assertRedirect();

        $message = ChatMessage::query()->sole();
        $this->assertSame('Rolou Adaga: 8', $message->text);
        $this->assertSame(8, $message->roll_data['total']);
    }

    public function test_characters_without_campaign_do_not_post(): void
    {
        $this->character->game_session_id = null;
        $this->character->save();

        $this->actingAs($this->player)->post(route('characters.test', $this->character), ['target' => 'attr:for', 'difficulty' => 'normal']);

        $this->assertSame(0, ChatMessage::query()->count());
    }
}
