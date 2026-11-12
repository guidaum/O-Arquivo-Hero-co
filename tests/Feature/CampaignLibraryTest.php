<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\CatalogItem;
use App\Models\Character;
use App\Models\GameSession;
use App\Models\RuleSet;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use App\Support\CampaignLibrary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Configurações por campanha com herança viva da base: a campanha herda a
 * base, altera o que quiser sem mexer nos originais, e as mudanças da base
 * chegam como sugestão (adotar ou manter).
 */
class CampaignLibraryTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $admin;

    private GameSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->admin = User::factory()->admin()->create();
        $this->session = $this->campaign('Crônicas', 'CRN001', $this->gm);
    }

    private function campaign(string $name, string $code, User $gm): GameSession
    {
        $session = new GameSession(['name' => $name, 'code' => $code]);
        $session->gm_id = $gm->id;
        $session->save();

        return $session;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function skillPayload(array $overrides = []): array
    {
        return [
            'name' => 'Furtividade', 'type' => 'Geral', 'purchase_cost' => 2, 'atp_cost' => 0,
            'damage' => null, 'difficulty_formula' => null, 'description' => null,
            ...$overrides,
        ];
    }

    private function library(?GameSession $session = null): CampaignLibrary
    {
        return CampaignLibrary::for($session ?? $this->session->fresh());
    }

    public function test_new_campaign_inherits_the_base(): void
    {
        $skill = Skill::query()->create($this->skillPayload());

        $row = $this->library()->rows(Skill::class)->first();

        $this->assertSame(CampaignLibrary::INHERITED, $row['status']);
        $this->assertTrue($this->library()->allows(Skill::class, $skill->id));
    }

    public function test_gm_customizes_an_entry_without_changing_the_base(): void
    {
        $skill = Skill::query()->create($this->skillPayload());
        $other = $this->campaign('Outra', 'OUT001', User::factory()->gm()->create());

        $this->actingAs($this->gm)
            ->put(route('gm.sessions.library.pericias.update', [$this->session, $skill]), $this->skillPayload(['purchase_cost' => 5]))
            ->assertRedirect(route('gm.sessions.library.index', [$this->session, 'tipo' => 'pericias']));

        $this->assertSame(2, $skill->fresh()->purchase_cost);
        $this->assertSame(5, $this->library()->entries(Skill::class)->get($skill->id)->purchase_cost);
        $this->assertSame(2, $this->library($other)->entries(Skill::class)->get($skill->id)->purchase_cost);
        $this->assertSame(CampaignLibrary::CUSTOMIZED, $this->library()->rows(Skill::class)->first()['status']);

        // Restaurar a base desfaz a versão da campanha.
        $this->actingAs($this->gm)->delete(route('gm.sessions.library.destroy', [$this->session, 'pericias', $skill]))->assertSessionHas('status');
        $this->assertSame(CampaignLibrary::INHERITED, $this->library()->rows(Skill::class)->first()['status']);
    }

    public function test_base_change_arrives_as_suggestion(): void
    {
        $skill = Skill::query()->create($this->skillPayload());

        $this->actingAs($this->gm)->put(route('catalog.skills.update', $skill), $this->skillPayload(['purchase_cost' => 4]))
            ->assertSessionHasNoErrors();

        // A base mudou, mas a campanha continua com a versão anterior até decidir.
        $this->assertSame(4, $skill->fresh()->purchase_cost);
        $row = $this->library()->rows(Skill::class)->first();
        $this->assertSame(CampaignLibrary::UPDATE, $row['status']);
        $this->assertSame(['purchase_cost'], $row['changes']);
        $this->assertSame(2, $this->library()->entries(Skill::class)->get($skill->id)->purchase_cost);
        $this->assertSame(1, $this->library()->pendingCounts()['pericias']);

        // Campanha criada depois da mudança já herda a base atual.
        $newer = $this->campaign('Nova', 'NOV001', $this->gm);
        $this->assertSame(4, $this->library($newer)->entries(Skill::class)->get($skill->id)->purchase_cost);

        $this->actingAs($this->gm)->put(route('gm.sessions.library.adopt', [$this->session, 'pericias', $skill]))->assertSessionHas('status');
        $this->assertSame(4, $this->library()->entries(Skill::class)->get($skill->id)->purchase_cost);
        $this->assertSame(CampaignLibrary::INHERITED, $this->library()->rows(Skill::class)->first()['status']);
    }

    public function test_gm_can_keep_the_campaign_version(): void
    {
        $skill = Skill::query()->create($this->skillPayload());
        $this->actingAs($this->gm)->put(route('catalog.skills.update', $skill), $this->skillPayload(['purchase_cost' => 4]));

        $this->actingAs($this->gm)->put(route('gm.sessions.library.keep', [$this->session, 'pericias', $skill]))->assertSessionHas('status');

        $row = $this->library()->rows(Skill::class)->first();
        $this->assertSame(CampaignLibrary::CUSTOMIZED, $row['status']);
        $this->assertSame(2, $row['entry']->purchase_cost);
        $this->assertSame(0, $this->library()->pendingCounts()['pericias']);
    }

    public function test_new_base_entry_is_suggested_to_existing_campaigns(): void
    {
        $this->actingAs($this->gm)->post(route('catalog.skills.store'), $this->skillPayload(['name' => 'Alquimia']))->assertSessionHasNoErrors();
        $skill = Skill::query()->base()->where('name', 'Alquimia')->firstOrFail();

        $this->assertSame(CampaignLibrary::NEW, $this->library()->rows(Skill::class)->first()['status']);
        $this->assertFalse($this->library()->allows(Skill::class, $skill->id));

        $this->actingAs($this->gm)->post(route('gm.sessions.library.bulk', $this->session), ['tipo' => 'pericias', 'acao' => 'adotar'])
            ->assertSessionHas('status');

        $this->assertTrue($this->library()->allows(Skill::class, $skill->id));
    }

    public function test_hidden_entry_leaves_the_campaign_library(): void
    {
        $item = CatalogItem::query()->create(['name' => 'Espada', 'category' => 'weapons', 'value' => 10]);

        $this->actingAs($this->gm)->put(route('gm.sessions.library.visibility', [$this->session, 'itens', $item]), ['hidden' => 1])
            ->assertSessionHas('status');
        $this->assertFalse($this->library()->allows(CatalogItem::class, $item->id));

        $this->actingAs($this->gm)->put(route('gm.sessions.library.visibility', [$this->session, 'itens', $item]), ['hidden' => 0]);
        $this->assertTrue($this->library()->allows(CatalogItem::class, $item->id));
        // Sem diferenças da base, a campanha volta a herdar o item (nenhuma versão guardada).
        $this->assertSame(0, CatalogItem::query()->whereNotNull('base_id')->count());
    }

    public function test_campaign_only_entry_stays_in_its_campaign(): void
    {
        $other = $this->campaign('Outra', 'OUT001', $this->gm);

        $this->actingAs($this->gm)->post(route('gm.sessions.library.talentos.store', $this->session), [
            'name' => 'Navegação', 'category' => 'Mar', 'composition' => ['int'],
        ])->assertSessionHasNoErrors();

        $talent = Talent::query()->where('name', 'Navegação')->firstOrFail();

        $this->assertSame($this->session->id, $talent->game_session_id);
        $this->assertTrue($this->library()->allows(Talent::class, $talent->id));
        $this->assertFalse($this->library($other)->allows(Talent::class, $talent->id));
        // Pela lista, não pelo HTML: o aviso de sucesso do envio anterior também cita o nome.
        $this->actingAs($this->gm)->get(route('catalog.talents.index'))
            ->assertViewHas('talents', static fn ($talents): bool => collect($talents->items())->doesntContain('id', $talent->id));
    }

    public function test_sheet_uses_the_campaign_version_of_its_skills(): void
    {
        $skill = Skill::query()->create($this->skillPayload());
        $player = User::factory()->create();
        $character = new Character(['name' => 'Alden', 'skill_points' => 0]);
        $character->user_id = $player->id;
        $character->game_session_id = $this->session->id;
        $character->save();
        $character->skills()->attach($skill->id, ['level' => 1, 'type' => null]);

        $this->actingAs($this->gm)->put(route('gm.sessions.library.pericias.update', [$this->session, $skill]), $this->skillPayload(['name' => 'Sombra Viva', 'purchase_cost' => 7]));

        $this->actingAs($this->gm)->get(route('characters.show', $character))->assertOk()->assertSee('Sombra Viva');

        // Remover devolve o custo da versão da campanha.
        $this->actingAs($this->gm)->delete(route('characters.skills.destroy', [$character, $skill]));
        $this->assertSame(7, $character->fresh()->skill_points);
    }

    public function test_base_rule_change_arrives_as_suggestion(): void
    {
        $global = new RuleSet(['max_attribute_points' => 100, 'initial_money' => 50]);
        $global->saveAsGlobal();

        $global->max_attribute_points = 120;
        $global->initial_money = 80;
        $global->saveAsGlobal();

        // A campanha que herdava a base fica com as regras anteriores e duas sugestões.
        $campaign = $this->session->fresh()->ruleSet;
        $this->assertSame(100, $campaign->max_attribute_points);
        $this->assertSame(['max_attribute_points', 'initial_money'], array_keys($campaign->pendingBaseChanges($global->fresh())));

        $this->actingAs($this->gm)->get(route('gm.sessions.rules.edit', $this->session))->assertOk()->assertSee('A base mudou em 2 regra(s)');

        $this->actingAs($this->gm)->put(route('gm.sessions.rules.adopt', $this->session), ['adopt' => ['initial_money']])->assertSessionHas('status');

        $campaign->refresh();
        $this->assertSame(100, $campaign->max_attribute_points);
        $this->assertSame(80, $campaign->initial_money);
        $this->assertSame([], $campaign->pendingBaseChanges($global->fresh()));

        // Restaurar volta a usar a base como está.
        $this->actingAs($this->gm)->delete(route('gm.sessions.rules.restore', $this->session))->assertSessionHas('status');
        $this->assertNull($this->session->fresh()->ruleSet);
        $this->assertSame(120, RuleSet::forSession($this->session->fresh())->max_attribute_points);
    }

    public function test_only_the_campaign_gm_manages_its_library(): void
    {
        $skill = Skill::query()->create($this->skillPayload());
        $intruder = User::factory()->gm()->create();

        $this->actingAs($intruder)->get(route('gm.sessions.library.index', $this->session))->assertForbidden();
        $this->actingAs($intruder)->put(route('gm.sessions.library.pericias.update', [$this->session, $skill]), $this->skillPayload())->assertForbidden();
        $this->actingAs($this->gm)->get(route('gm.sessions.library.index', [$this->session, 'tipo' => 'pericias']))->assertOk()->assertSee('Furtividade');
    }

    public function test_deleting_a_base_entry_keeps_it_in_existing_campaigns(): void
    {
        $skill = Skill::query()->create($this->skillPayload());

        $this->actingAs($this->gm)->delete(route('catalog.skills.destroy', $skill))->assertSessionHas('status');

        // Some do catálogo base e das campanhas novas...
        $this->assertNotNull($skill->fresh()->archived_at);
        $this->assertFalse(CampaignLibrary::for(null)->allows(Skill::class, $skill->id));
        $newer = $this->campaign('Nova', 'NOV001', $this->gm);
        $this->assertFalse($this->library($newer)->allows(Skill::class, $skill->id));

        // ...mas a campanha existente continua com ele, avisada.
        $this->assertTrue($this->library()->allows(Skill::class, $skill->id));
        $this->assertSame(CampaignLibrary::REMOVED, $this->library()->rows(Skill::class)->first()['status']);

        // Não há base para adotar; ocultar tira da biblioteca da campanha.
        $this->actingAs($this->gm)->put(route('gm.sessions.library.adopt', [$this->session, 'pericias', $skill]))->assertSessionHasErrors('library');
        $this->actingAs($this->gm)->put(route('gm.sessions.library.visibility', [$this->session, 'pericias', $skill]), ['hidden' => 1]);
        $this->assertFalse($this->library()->allows(Skill::class, $skill->id));
    }

    public function test_campaign_change_is_suggested_to_the_admin_and_applied_to_the_base(): void
    {
        $skill = Skill::query()->create($this->skillPayload());
        $other = $this->campaign('Outra', 'OUT001', User::factory()->gm()->create());

        $this->actingAs($this->gm)->put(route('gm.sessions.library.pericias.update', [$this->session, $skill]), $this->skillPayload(['purchase_cost' => 5]));

        $this->actingAs($this->admin)->get(route('admin.suggestions.index'))
            ->assertOk()
            ->assertSee('Furtividade')
            ->assertSee('Alterado na campanha')
            ->assertSee('Crônicas');

        $this->actingAs($this->admin)->put(route('admin.suggestions.promote', ['pericias', $this->library()->versionOf($skill, create: false)]))
            ->assertSessionHas('status');

        // A base mudou; a campanha de origem volta a herdar e a outra recebe como sugestão.
        $this->assertSame(5, $skill->fresh()->purchase_cost);
        $this->assertSame(CampaignLibrary::INHERITED, $this->library()->rows(Skill::class)->first()['status']);
        $this->assertSame(CampaignLibrary::UPDATE, $this->library($other)->rows(Skill::class)->first()['status']);
        $this->assertSame(0, CampaignLibrary::proposals()->count());
    }

    public function test_campaign_creation_is_promoted_to_the_base_with_the_same_id(): void
    {
        $other = $this->campaign('Outra', 'OUT001', User::factory()->gm()->create());

        $this->actingAs($this->gm)->post(route('gm.sessions.library.talentos.store', $this->session), [
            'name' => 'Navegação', 'category' => 'Mar', 'composition' => ['int'],
        ]);
        $talent = Talent::query()->where('name', 'Navegação')->firstOrFail();

        $this->actingAs($this->gm)->put(route('admin.suggestions.promote', ['talentos', $talent]))->assertForbidden();
        $this->actingAs($this->admin)->put(route('admin.suggestions.promote', ['talentos', $talent]))->assertSessionHas('status');

        $this->assertTrue($talent->fresh()->isBase());
        $this->assertSame(CampaignLibrary::INHERITED, $this->library()->rows(Talent::class)->first()['status']);
        $this->assertSame(CampaignLibrary::NEW, $this->library($other)->rows(Talent::class)->first()['status']);
    }

    public function test_admin_can_dismiss_a_campaign_suggestion(): void
    {
        $this->actingAs($this->gm)->post(route('gm.sessions.library.pericias.store', $this->session), $this->skillPayload(['name' => 'Pesca']));
        $skill = Skill::query()->where('name', 'Pesca')->firstOrFail();

        $this->actingAs($this->admin)->put(route('admin.suggestions.dismiss', ['pericias', $skill]))->assertSessionHas('status');

        $this->assertSame(0, CampaignLibrary::proposals()->count());
        $this->assertTrue($this->library()->allows(Skill::class, $skill->id));
        $this->assertSame(0, Skill::query()->base()->count());
    }

    public function test_campaign_ammo_defines_its_compatible_weapons(): void
    {
        $bow = CatalogItem::query()->create(['name' => 'Arco', 'category' => 'weapons', 'value' => 30]);

        $this->actingAs($this->gm)->post(route('gm.sessions.library.itens.store', $this->session), [
            'name' => 'Flecha Élfica', 'category' => 'ammo', 'rarity' => 'Rare', 'weight' => 0.1, 'value' => 2,
            'defense' => 0, 'related' => [$bow->id],
        ])->assertSessionHasNoErrors();

        $arrow = CatalogItem::query()->where('name', 'Flecha Élfica')->firstOrFail();

        $this->assertSame($this->session->id, $arrow->game_session_id);
        $this->assertSame([$bow->id], $arrow->relatedItems()->pluck('catalog_items.id')->all());
    }

    public function test_deleting_a_campaign_removes_its_versions(): void
    {
        $skill = Skill::query()->create($this->skillPayload());
        $this->library()->versionOf($skill);

        $this->session->delete();

        $this->assertSame(0, Skill::query()->whereNotNull('base_id')->count());
        $this->assertModelExists($skill);
    }
}
