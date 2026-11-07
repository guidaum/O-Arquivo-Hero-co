<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Character;
use App\Models\GameSession;
use App\Models\JournalEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Diário de Sessão (SessionJournal.tsx do sistema antigo).
 */
class JournalTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    private User $gm;

    private GameSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create();
        $this->session = new GameSession(['name' => 'Crônicas de Eldoria', 'code' => 'ELD001']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);
    }

    private function entryOf(User $author, array $attributes = []): JournalEntry
    {
        $entry = new JournalEntry([
            'title' => 'O Portão de Ferro',
            'session_date' => '2026-10-20',
            'content' => "Primeiro parágrafo.\nSegundo parágrafo.",
            'timeline' => [['time' => '14:00', 'event' => 'Emboscada na ponte', 'type' => 'Combate', 'status' => 'completed']],
            'npcs' => [['name' => 'Mestre Kenneth', 'role' => 'Comandante', 'status' => 'Amigável', 'image_path' => null]],
            ...$attributes,
        ]);
        $entry->user_id = $author->id;
        $entry->save();

        return $entry;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'A Cripta Esquecida',
            'session_date' => '2026-11-01',
            'location' => 'Catacumbas',
            'duration' => '4 horas',
            'players_count' => 3,
            'game_session_id' => $this->session->id,
            'content' => 'O grupo desceu à cripta.',
            'timeline' => [
                ['time' => '20:00', 'event' => 'Chegada à cripta', 'type' => 'Exploração', 'status' => 'completed'],
                ['time' => '', 'event' => '', 'type' => 'Combate', 'status' => 'current'],
            ],
            'npcs' => [['name' => 'Sacerdotisa', 'role' => 'Guia', 'status' => 'Neutro']],
            ...$overrides,
        ];
    }

    public function test_index_shows_the_latest_entry_with_timeline_and_npcs(): void
    {
        $this->entryOf($this->player, ['title' => 'Registro Antigo', 'session_date' => '2026-01-01']);
        $this->entryOf($this->player);

        $this->actingAs($this->player)->get('/diario')
            ->assertOk()
            ->assertSee('O Portão de Ferro')
            ->assertSee('Segundo parágrafo.')
            ->assertSee('Emboscada na ponte')
            ->assertSee('Mestre Kenneth')
            ->assertSee('Registro Antigo (01/01/2026)');
    }

    public function test_empty_journal_invites_to_write(): void
    {
        $this->actingAs($this->player)->get('/diario')->assertOk()->assertSee('Escreva o primeiro registro');
    }

    public function test_entry_is_created_with_timeline_and_npc_image(): void
    {
        $this->actingAs($this->player)->post('/diario', $this->payload([
            'npcs' => [['name' => 'Sacerdotisa', 'role' => 'Guia', 'status' => 'Neutro', 'image' => UploadedFile::fake()->create('npc.png', 10, 'image/png')]],
        ]))->assertSessionHasNoErrors();

        $entry = JournalEntry::query()->firstOrFail();

        $this->assertSame($this->player->id, $entry->user_id);
        $this->assertSame($this->session->id, $entry->game_session_id);
        $this->assertCount(1, $entry->timeline, 'Eventos vazios são ignorados.');
        $this->assertSame('Chegada à cripta', $entry->timeline[0]['event']);
        Storage::disk('public')->assertExists($entry->npcs[0]['image_path']);
    }

    public function test_campaign_and_character_must_belong_to_the_author(): void
    {
        $otherSession = new GameSession(['name' => 'Outra', 'code' => 'OUT001']);
        $otherSession->gm_id = $this->gm->id;
        $otherSession->save();

        $foreignCharacter = new Character(['name' => 'Alheio']);
        $foreignCharacter->user_id = $this->gm->id;
        $foreignCharacter->save();

        $this->actingAs($this->player)->post('/diario', $this->payload([
            'game_session_id' => $otherSession->id,
            'character_id' => $foreignCharacter->id,
        ]))->assertSessionHasErrors(['game_session_id', 'character_id']);
    }

    public function test_npc_image_path_can_not_point_to_other_files(): void
    {
        $entry = $this->entryOf($this->player);

        $this->actingAs($this->player)->put(route('journal.update', $entry), $this->payload([
            'npcs' => [['name' => 'Intruso', 'status' => 'Hostil', 'image_path' => 'avatars/outro-usuario.png']],
        ]))->assertSessionHasErrors('npcs.0.image_path');
    }

    public function test_replacing_an_npc_image_deletes_the_old_file(): void
    {
        $old = UploadedFile::fake()->create('velha.png', 10, 'image/png')->store('journal/npcs', 'public');
        $entry = $this->entryOf($this->player, ['npcs' => [['name' => 'Kenneth', 'role' => '', 'status' => 'Neutro', 'image_path' => $old]]]);

        $this->actingAs($this->player)->put(route('journal.update', $entry), $this->payload([
            'npcs' => [['name' => 'Kenneth', 'status' => 'Neutro', 'image_path' => $old, 'remove_image' => 1]],
        ]))->assertSessionHasNoErrors();

        Storage::disk('public')->assertMissing($old);
        $this->assertNull($entry->fresh()->npcs[0]['image_path']);
    }

    public function test_campaign_members_read_entries_but_only_the_author_edits(): void
    {
        $entry = $this->entryOf($this->player, ['game_session_id' => $this->session->id]);

        $this->actingAs($this->gm)->get('/diario?visao=campanha&campanha='.$this->session->id)
            ->assertOk()
            ->assertSee('O Portão de Ferro')
            ->assertSee('Escrito por '.$this->player->name)
            ->assertDontSee(route('journal.edit', $entry), false);

        $this->actingAs($this->gm)->get(route('journal.edit', $entry))->assertForbidden();
        $this->actingAs($this->gm)->delete(route('journal.destroy', $entry))->assertForbidden();

        $outsider = User::factory()->create();
        $this->actingAs($outsider)->get('/diario?visao=campanha&campanha='.$this->session->id)->assertDontSee('O Portão de Ferro');
    }

    public function test_entries_can_be_filtered_by_character(): void
    {
        $character = new Character(['name' => 'Alden']);
        $character->user_id = $this->player->id;
        $character->save();

        $this->entryOf($this->player, ['title' => 'Da Alden', 'character_id' => $character->id]);
        $this->entryOf($this->player, ['title' => 'Geral']);

        $this->actingAs($this->player)->get('/diario?visao=personagem&personagem='.$character->id)
            ->assertSee('Da Alden')
            ->assertDontSee('Geral (');
    }

    public function test_gallery_upload_and_removal(): void
    {
        $entry = $this->entryOf($this->player);

        $this->actingAs($this->player)->post(route('journal.images.store', $entry), [
            'images' => [UploadedFile::fake()->create('a.png', 10, 'image/png'), UploadedFile::fake()->create('b.jpg', 10, 'image/jpeg')],
        ])->assertSessionHasNoErrors();

        $images = $entry->images()->get();
        $this->assertCount(2, $images);
        Storage::disk('public')->assertExists($images[0]->path);

        $this->actingAs($this->gm)->delete(route('journal.images.destroy', [$entry, $images[0]]))->assertForbidden();
        $this->actingAs($this->player)->delete(route('journal.images.destroy', [$entry, $images[0]]))->assertSessionHas('status');

        Storage::disk('public')->assertMissing($images[0]->path);
        $this->assertSame(1, $entry->images()->count());
    }

    public function test_deleting_an_entry_removes_its_files(): void
    {
        $npcImage = UploadedFile::fake()->create('npc.png', 10, 'image/png')->store('journal/npcs', 'public');
        $entry = $this->entryOf($this->player, ['npcs' => [['name' => 'Kenneth', 'status' => 'Neutro', 'image_path' => $npcImage]]]);
        $gallery = UploadedFile::fake()->create('g.png', 10, 'image/png')->store('journal', 'public');
        $entry->images()->create(['path' => $gallery, 'position' => 0]);

        $this->actingAs($this->player)->delete(route('journal.destroy', $entry))->assertRedirect(route('journal.index'));

        $this->assertModelMissing($entry);
        Storage::disk('public')->assertMissing($npcImage);
        Storage::disk('public')->assertMissing($gallery);
    }

    public function test_dashboard_campaign_card_opens_the_campaign_journal(): void
    {
        $this->actingAs($this->player)->get('/')
            ->assertSee(route('journal.index', ['visao' => 'campanha', 'campanha' => $this->session->id]));
    }
}
