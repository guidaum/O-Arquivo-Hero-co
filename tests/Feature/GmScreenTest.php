<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Character;
use App\Models\ChatMessage;
use App\Models\GameSession;
use App\Models\GameSessionReference;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Escudo do Mestre: tela de apoio da campanha (grupo, NPCs, anotações,
 * referências visuais, notas do mestre, mapas, regras e chat).
 */
class GmScreenTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private GameSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create(['email' => 'jogador@exemplo.com']);
        $this->session = $this->campaign($this->gm, 'Crônicas', 'CRN234');
        $this->session->players()->attach($this->player);

        $hero = new Character(['name' => 'Alden', 'level' => 2, 'stats' => ['for' => 4, 'con' => 3], 'current_pv' => 30]);
        $hero->user_id = $this->player->id;
        $hero->game_session_id = $this->session->id;
        $hero->save();

        $npc = new Character(['name' => 'Taverneiro Bram', 'stats' => ['for' => 2, 'con' => 1]]);
        $npc->user_id = $this->gm->id;
        $npc->game_session_id = $this->session->id;
        $npc->is_npc = true;
        $npc->save();
    }

    private function campaign(User $gm, string $name, string $code): GameSession
    {
        $session = new GameSession(['name' => $name, 'code' => $code]);
        $session->gm_id = $gm->id;
        $session->save();

        return $session;
    }

    private function reference(array $attributes = [], string $path = 'https://exemplo.com/castelo.jpg'): GameSessionReference
    {
        $reference = new GameSessionReference(['title' => 'Castelo', 'category' => 'scene', ...$attributes]);
        $reference->game_session_id = $this->session->id;
        $reference->image_path = $path;
        $reference->save();

        return $reference;
    }

    public function test_gm_sees_the_screen_with_party_npcs_and_rules(): void
    {
        $this->reference(['title' => 'Mapa da Cidade']);

        $this->actingAs($this->gm)
            ->get(route('gm.sessions.screen', $this->session))
            ->assertOk()
            ->assertSee('Escudo do Mestre')
            ->assertSee('Alden')
            ->assertSee('Taverneiro Bram')
            ->assertSee('Mapa da Cidade')
            ->assertSee('Dificuldade (meta)')
            ->assertSee('chat--docked', false);
    }

    public function test_gm_dashboard_links_to_the_screen(): void
    {
        $this->actingAs($this->gm)
            ->get(route('gm.sessions.show', $this->session))
            ->assertOk()
            ->assertSee(route('gm.sessions.screen', $this->session), false);
    }

    public function test_players_cannot_open_the_screen_nor_manage_references(): void
    {
        $reference = $this->reference();

        $this->actingAs($this->player)->get(route('gm.sessions.screen', $this->session))->assertForbidden();
        $this->actingAs($this->player)
            ->postJson(route('gm.sessions.references.store', $this->session), ['image_url' => 'https://exemplo.com/a.jpg'])
            ->assertForbidden();
        $this->actingAs($this->player)
            ->postJson(route('gm.sessions.references.share', [$this->session, $reference]))
            ->assertForbidden();
    }

    public function test_gm_adds_a_reference_from_a_link(): void
    {
        $this->actingAs($this->gm)
            ->postJson(route('gm.sessions.references.store', $this->session), [
                'title' => 'Dragão Vermelho',
                'category' => 'creature',
                'notes' => 'Mostrar quando entrarem no covil.',
                'image_url' => 'https://exemplo.com/dragao.png',
            ])
            ->assertCreated()
            ->assertJsonPath('reference.title', 'Dragão Vermelho')
            ->assertJsonPath('reference.category', 'creature')
            ->assertJsonPath('reference.image_url', 'https://exemplo.com/dragao.png');

        $this->assertDatabaseHas('game_session_references', ['game_session_id' => $this->session->id, 'title' => 'Dragão Vermelho']);
    }

    public function test_gm_uploads_a_reference_image(): void
    {
        Storage::fake('public');

        $response = $this->actingAs($this->gm)
            ->post(route('gm.sessions.references.store', $this->session), [
                'image' => UploadedFile::fake()->create('ruinas.png', 12, 'image/png'),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('reference.title', 'Referência sem título');

        $reference = GameSessionReference::query()->findOrFail($response->json('reference.id'));
        $this->assertStringStartsWith(GameSessionReference::DIRECTORY.'/', $reference->image_path);
        Storage::disk('public')->assertExists($reference->image_path);
    }

    public function test_a_reference_needs_an_image_and_a_valid_category(): void
    {
        $this->actingAs($this->gm)
            ->postJson(route('gm.sessions.references.store', $this->session), ['title' => 'Sem imagem'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.image.0', 'Envie uma imagem ou cole o link de uma.');

        $this->actingAs($this->gm)
            ->postJson(route('gm.sessions.references.store', $this->session), ['image_url' => 'https://exemplo.com/a.jpg', 'category' => 'invalida'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('category');
    }

    public function test_gm_edits_pins_and_deletes_a_reference(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('referencias/porto.jpg', 'imagem');
        $reference = $this->reference([], 'referencias/porto.jpg');

        $this->actingAs($this->gm)
            ->putJson(route('gm.sessions.references.update', [$this->session, $reference]), ['title' => 'Porto Sombrio', 'category' => 'map', 'notes' => 'Segredo'])
            ->assertOk()
            ->assertJsonPath('reference.title', 'Porto Sombrio')
            ->assertJsonPath('reference.category', 'map');

        $this->actingAs($this->gm)
            ->putJson(route('gm.sessions.references.update', [$this->session, $reference]), ['pinned' => true])
            ->assertOk()
            ->assertJsonPath('reference.pinned', true)
            ->assertJsonPath('reference.title', 'Porto Sombrio');

        $this->actingAs($this->gm)
            ->deleteJson(route('gm.sessions.references.destroy', [$this->session, $reference]))
            ->assertOk();

        $this->assertModelMissing($reference);
        Storage::disk('public')->assertMissing('referencias/porto.jpg');
    }

    public function test_references_are_scoped_to_their_campaign(): void
    {
        $otherGm = User::factory()->gm()->create();
        $other = $this->campaign($otherGm, 'Outra', 'OTR234');
        $reference = $this->reference();

        $this->actingAs($otherGm)
            ->deleteJson(route('gm.sessions.references.destroy', [$other, $reference]))
            ->assertNotFound();

        $this->assertModelExists($reference);
    }

    public function test_showing_a_reference_posts_the_full_url_to_the_chat_and_keeps_the_file(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('referencias/vilao.jpg', 'imagem');
        $reference = $this->reference(['title' => 'O Vilão', 'notes' => 'Ele é o irmão do rei'], 'referencias/vilao.jpg');

        $this->actingAs($this->gm)
            ->postJson(route('gm.sessions.references.share', [$this->session, $reference]))
            ->assertOk();

        $message = ChatMessage::query()->where('game_session_id', $this->session->id)->sole();
        $this->assertSame('O Vilão', $message->text);
        $this->assertStringStartsWith('http', $message->image_path);
        $this->assertStringNotContainsString('irmão do rei', (string) $message->text);

        // Limpar o chat apaga só os arquivos do chat, nunca o da referência.
        $this->actingAs($this->gm)->deleteJson(route('chat.clear', $this->session))->assertOk();
        Storage::disk('public')->assertExists('referencias/vilao.jpg');
    }

    public function test_gm_notes_save_through_fetch(): void
    {
        $this->actingAs($this->gm)
            ->putJson(route('gm.sessions.notes', $this->session), ['gm_notes' => 'O artefato está na cripta.'])
            ->assertOk()
            ->assertJsonPath('message', 'Notas do mestre salvas!')
            ->assertJsonStructure(['saved_at']);

        $this->assertSame('O artefato está na cripta.', $this->session->fresh()->gm_notes);
    }

    public function test_deleting_the_campaign_removes_reference_files(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('referencias/mapa.jpg', 'imagem');
        $this->reference([], 'referencias/mapa.jpg');

        $this->actingAs($this->gm)
            ->delete(route('gm.sessions.destroy', $this->session), ['confirmation' => 'Crônicas'])
            ->assertRedirect(route('dashboard'));

        Storage::disk('public')->assertMissing('referencias/mapa.jpg');
        $this->assertDatabaseCount('game_session_references', 0);
    }
}
