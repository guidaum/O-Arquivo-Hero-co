<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Character;
use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 7b: menu de ações com rolador de dados e anotações rápidas.
 */
class ActionMenuTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    private Character $character;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create(['name' => 'Jogadora Exemplo']);
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN234']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->character = new Character(['name' => 'Alden']);
        $this->character->user_id = $this->player->id;
        $this->character->game_session_id = $this->session->id;
        $this->character->save();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function roll(array $overrides = []): array
    {
        return [
            'sides' => 20,
            'quantity' => 1,
            'modifier' => 2,
            'advantage_mode' => 'advantage',
            'target' => 12,
            'roll_under' => true,
            ...$overrides,
        ];
    }

    // Rolador de dados

    public function test_dice_are_rolled_on_the_server(): void
    {
        $response = $this->actingAs($this->player)->postJson(route('dice.roll'), $this->roll())
            ->assertOk()
            ->assertJsonPath('posted', false)
            ->assertJsonPath('roll.sides', 20)
            ->assertJsonPath('roll.modifier', 2);

        $roll = $response->json('roll');
        $this->assertCount(1, $roll['rolls']);
        $this->assertCount(1, $roll['discarded_rolls']);
        $this->assertSame($roll['rolls'][0] + 2, $roll['total']);
        $this->assertContains($roll['outcome'], ['critical', 'fumble', 'success', 'failure']);
        $this->assertSame(0, ChatMessage::query()->count());
    }

    public function test_invalid_dice_are_rejected(): void
    {
        $this->actingAs($this->player)->postJson(route('dice.roll'), $this->roll(['sides' => 7]))->assertJsonValidationErrors('sides');
        $this->actingAs($this->player)->postJson(route('dice.roll'), $this->roll(['quantity' => 21]))->assertJsonValidationErrors('quantity');
    }

    public function test_rolls_in_a_campaign_go_to_its_chat(): void
    {
        $this->actingAs($this->player)->postJson(route('dice.roll'), $this->roll([
            'quantity' => 3,
            'game_session_id' => $this->session->id,
            'character_id' => $this->character->id,
        ]))->assertOk()->assertJsonPath('posted', true);

        $message = ChatMessage::query()->sole();
        $this->assertSame('Alden', $message->sender_name);
        $this->assertSame(ChatMessage::TYPE_ROLL, $message->type);
        $this->assertStringStartsWith('🎲 3d20 (Vantagem) + 2 vs ≤12 ➔ ', $message->text);
        $this->assertSame('3d20', $message->roll_data['rolls'][0]['die']);
    }

    public function test_rolls_are_not_posted_to_foreign_campaigns(): void
    {
        $this->actingAs(User::factory()->create())->postJson(route('dice.roll'), $this->roll(['game_session_id' => $this->session->id]))
            ->assertOk()
            ->assertJsonPath('posted', false);

        $this->assertSame(0, ChatMessage::query()->count());
    }

    // Anotações rápidas

    public function test_owner_manages_character_notes(): void
    {
        $url = route('characters.notes.index', $this->character);

        $note = $this->actingAs($this->player)->postJson($url, ['content' => 'Procurar o mestre desaparecido.', 'category' => 'hook'])
            ->assertCreated()
            ->assertJsonPath('note.title', 'Ideia do Personagem')
            ->json('note');

        $this->actingAs($this->player)->putJson($url.'/'.$note['id'], ['pinned' => true])->assertOk()->assertJsonPath('note.pinned', true);
        $this->actingAs($this->player)->putJson($url.'/'.$note['id'], ['title' => 'Objetivo', 'content' => 'Achar a família.', 'category' => 'npc'])
            ->assertOk()
            ->assertJsonPath('note.title', 'Objetivo')
            ->assertJsonPath('note.pinned', true);

        $this->actingAs($this->player)->getJson($url)->assertOk()->assertJsonCount(1, 'notes')->assertJsonPath('notes.0.category', 'npc');

        // O mestre da campanha também vê as anotações do personagem.
        $this->actingAs($this->gm)->getJson($url)->assertOk()->assertJsonCount(1, 'notes');

        $this->actingAs($this->player)->deleteJson($url.'/'.$note['id'])->assertOk();
        $this->assertSame(0, $this->character->notes()->count());
    }

    public function test_notes_are_protected(): void
    {
        $url = route('characters.notes.index', $this->character);
        $this->actingAs(User::factory()->create())->getJson($url)->assertForbidden();

        $this->actingAs($this->player)->postJson($url, ['title' => '', 'content' => ' '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['content' => 'Escreva um título ou um texto para a anotação.']);

        // Uma anotação só é encontrada dentro do próprio personagem.
        $other = new Character(['name' => 'Outro']);
        $other->user_id = $this->player->id;
        $other->save();
        $note = $other->notes()->create(['title' => 'Segredo']);

        $this->actingAs($this->player)->deleteJson($url.'/'.$note->id)->assertNotFound();
    }

    public function test_campaign_notes_belong_to_the_gm(): void
    {
        $url = route('sessions.notes.index', $this->session);

        $this->actingAs($this->player)->getJson($url)->assertForbidden();
        $this->actingAs($this->gm)->postJson($url, ['content' => 'Ruínas do norte guardam um artefato.'])
            ->assertCreated()
            ->assertJsonPath('note.title', 'Nota da Campanha')
            ->assertJsonPath('note.category', 'general');
        $this->actingAs($this->gm)->postJson($url, ['title' => 'Taverna', 'category' => 'location'])->assertCreated();

        $this->actingAs($this->gm)->getJson($url)->assertJsonCount(2, 'notes');
        $this->actingAs($this->gm)->deleteJson($url)->assertOk();
        $this->assertSame(0, $this->session->notes()->count());
    }

    // Telas

    public function test_sheet_and_gm_page_show_the_action_menu(): void
    {
        $this->actingAs($this->player)->get(route('characters.show', $this->character))
            ->assertOk()
            ->assertSee('Rolador de Dados')
            ->assertSee('Anotações Rápidas')
            ->assertSee(route('characters.notes.index', $this->character), false)
            ->assertDontSee(route('sessions.notes.index', $this->session), false);

        $this->actingAs($this->gm)->get(route('gm.sessions.show', $this->session))
            ->assertOk()
            ->assertSee('Rolador de Dados')
            ->assertSee(route('sessions.notes.index', $this->session), false);
    }
}
