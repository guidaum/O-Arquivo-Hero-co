<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\TraitType;
use App\Models\Character;
use App\Models\CharacterTrait;
use App\Models\GameSession;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Edição da ficha: o que a ficha antiga permitia ao mestre e ao jogador.
 */
class CharacterEditTest extends TestCase
{
    use RefreshDatabase;

    private User $player;

    private User $gm;

    private GameSession $session;

    private Character $character;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->player = User::factory()->create();
        $this->gm = User::factory()->gm()->create();
        $this->session = new GameSession(['name' => 'Crônicas', 'code' => 'CRN001']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);

        $this->character = new Character(['name' => 'Alden', 'skill_points' => 5, 'power_points' => 2, 'stats' => ['for' => 10]]);
        $this->character->user_id = $this->player->id;
        $this->character->game_session_id = $this->session->id;
        $this->character->save();
    }

    private function unlock(): void
    {
        $this->character->can_edit_stats = true;
        $this->character->save();
    }

    public function test_player_needs_the_gm_to_unlock_editing(): void
    {
        $this->actingAs($this->player)->put(route('characters.details', $this->character), ['name' => 'Novo'])->assertForbidden();
        $this->actingAs($this->player)->put(route('characters.unlock', $this->character))->assertForbidden();

        $this->actingAs($this->gm)->put(route('characters.unlock', $this->character))->assertSessionHas('status');
        $this->assertTrue($this->character->fresh()->can_edit_stats);

        $this->actingAs($this->player)->put(route('characters.details', $this->character), ['name' => 'Alden, o Bravo', 'class' => 'Paladino'])
            ->assertSessionHasNoErrors();
        $this->assertSame('Alden, o Bravo', $this->character->fresh()->name);
    }

    public function test_portrait_upload_replaces_the_old_file(): void
    {
        $this->unlock();
        $old = UploadedFile::fake()->create('velho.png', 10, 'image/png')->store('characters', 'public');
        $this->character->image_path = $old;
        $this->character->save();

        $this->actingAs($this->player)->put(route('characters.details', $this->character), [
            'name' => 'Alden', 'image' => UploadedFile::fake()->create('novo.png', 10, 'image/png'),
        ])->assertSessionHasNoErrors();

        Storage::disk('public')->assertMissing($old);
        Storage::disk('public')->assertExists($this->character->fresh()->image_path);
    }

    public function test_skill_purchase_spends_and_refunds_points(): void
    {
        $this->unlock();
        $skill = Skill::query()->create(['name' => 'Espadas', 'type' => 'Luta', 'purchase_cost' => 3]);
        $expensive = Skill::query()->create(['name' => 'Arquimagia', 'type' => 'Mística', 'purchase_cost' => 10]);

        $this->actingAs($this->player)->post(route('characters.skills.store', $this->character), ['ability_id' => $skill->id])->assertSessionHas('status');
        $this->assertSame(2, $this->character->fresh()->skill_points);
        $this->assertTrue($this->character->skills()->whereKey($skill->id)->exists());

        $this->actingAs($this->player)->post(route('characters.skills.store', $this->character), ['ability_id' => $skill->id])
            ->assertSessionHasErrors('ability_id');
        $this->actingAs($this->player)->post(route('characters.skills.store', $this->character), ['ability_id' => $expensive->id])
            ->assertSessionHasErrors(['ability_id' => 'Pontos de perícia insuficientes! (Custo: 10, disponíveis: 2)']);

        $this->actingAs($this->player)->delete(route('characters.skills.destroy', [$this->character, $skill]))->assertSessionHas('status');
        $this->assertSame(5, $this->character->fresh()->skill_points);
        $this->assertFalse($this->character->skills()->whereKey($skill->id)->exists());
    }

    public function test_abilities_of_another_campaign_are_not_available(): void
    {
        $this->unlock();
        $other = new GameSession(['name' => 'Outra', 'code' => 'OUT001']);
        $other->gm_id = $this->gm->id;
        $other->save();
        $foreign = new Power(['name' => 'Segredo', 'type' => 'Geral', 'purchase_cost' => 1]);
        $foreign->game_session_id = $other->id;
        $foreign->save();

        $this->actingAs($this->player)->post(route('characters.powers.store', $this->character), ['ability_id' => $foreign->id])
            ->assertSessionHasErrors('ability_id');
    }

    public function test_traits_can_be_added_and_removed(): void
    {
        $this->unlock();
        $trait = CharacterTrait::query()->create(['name' => 'Força Bruta', 'type' => TraitType::Advantage, 'modifier' => 2, 'modifier_attribute' => 'for']);

        $this->actingAs($this->player)->post(route('characters.traits.store', $this->character), ['trait_id' => $trait->id])->assertSessionHas('status');
        $this->actingAs($this->player)->post(route('characters.traits.store', $this->character), ['trait_id' => $trait->id])->assertSessionHasErrors('trait_id');

        $this->actingAs($this->player)->get(route('characters.show', $this->character))->assertSee('Força Bruta');

        $this->actingAs($this->player)->delete(route('characters.traits.destroy', [$this->character, $trait]));
        $this->assertSame(0, $this->character->traits()->count());
    }

    public function test_talent_mods_ignore_zero_and_unknown_talents(): void
    {
        $this->unlock();
        $dodge = Talent::query()->create(['name' => 'Esquiva', 'composition' => ['agi']]);
        $block = Talent::query()->create(['name' => 'Bloqueio', 'composition' => ['for']]);

        $this->actingAs($this->player)->put(route('characters.talent-mods', $this->character), [
            'talent_mods' => [$dodge->id => 2, $block->id => 0, 999 => 5],
        ])->assertSessionHasNoErrors();

        $this->assertSame([(string) $dodge->id => 2], $this->character->fresh()->talent_mods);
    }

    public function test_gm_modifiers_need_justification_and_change_the_total(): void
    {
        $this->actingAs($this->player)->post(route('characters.gm-modifiers.store', $this->character), ['target' => 'for', 'value' => 2, 'justification' => 'Trapaça'])
            ->assertForbidden();

        $this->actingAs($this->gm)->post(route('characters.gm-modifiers.store', $this->character), ['target' => 'for', 'value' => 2, 'justification' => ''])
            ->assertSessionHasErrors(['justification' => 'A justificativa do mestre é obrigatória!']);

        $this->actingAs($this->gm)->post(route('characters.gm-modifiers.store', $this->character), ['target' => 'for', 'value' => 2, 'justification' => 'Bênção do templo'])
            ->assertSessionHas('status');

        $entry = $this->character->fresh()->gm_modifiers['for'][0];
        $this->assertSame(2, $entry['value']);
        $this->assertSame($this->gm->name, $entry['author_name']);

        $this->actingAs($this->player)->get(route('characters.show', $this->character))->assertSee('Bênção do templo');

        $this->actingAs($this->gm)->delete(route('characters.gm-modifiers.destroy', [$this->character, $entry['id']]))->assertSessionHas('status');
        $this->assertNull($this->character->fresh()->gm_modifiers);
    }

    public function test_campaign_link_only_to_own_campaigns(): void
    {
        $foreign = new GameSession(['name' => 'Alheia', 'code' => 'ALH001']);
        $foreign->gm_id = User::factory()->gm()->create()->id;
        $foreign->save();

        $this->actingAs($this->player)->put(route('characters.campaign', $this->character), ['game_session_id' => $foreign->id])
            ->assertSessionHasErrors('game_session_id');

        $this->actingAs($this->player)->put(route('characters.campaign', $this->character), ['game_session_id' => null])->assertSessionHas('status');
        $this->assertNull($this->character->fresh()->game_session_id);

        $this->actingAs($this->player)->put(route('characters.campaign', $this->character), ['game_session_id' => $this->session->id]);
        $this->assertSame($this->session->id, $this->character->fresh()->game_session_id);
    }

    public function test_sheet_shows_edit_controls_only_to_who_can_edit(): void
    {
        Skill::query()->create(['name' => 'Furtividade', 'type' => 'Geral', 'purchase_cost' => 1]);

        $this->actingAs($this->player)->get(route('characters.show', $this->character))
            ->assertDontSee('Salvar dados')
            ->assertSee('Edição bloqueada');

        $this->actingAs($this->gm)->get(route('characters.show', $this->character))
            ->assertSee('Salvar dados')
            ->assertSee('Modificador do Mestre')
            ->assertSee('Furtividade');
    }
}
