<?php

declare(strict_types=1);

namespace Tests\Feature\Catalog;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Enums\TraitType;
use App\Models\CatalogItem;
use App\Models\CharacterTrait;
use App\Models\Power;
use App\Models\Skill;
use App\Models\Suggestion;
use App\Models\Talent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Bibliotecas do Mestre (abas de catálogo do GMDashboard antigo).
 */
class CatalogTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
    }

    private function suggestion(SuggestionType $type, array $data, ?User $author = null): Suggestion
    {
        $suggestion = new Suggestion(['type' => $type, 'data' => $data]);
        $suggestion->user_id = ($author ?? User::factory()->create())->id;
        $suggestion->status = SuggestionStatus::Pending;
        $suggestion->save();

        return $suggestion;
    }

    public function test_catalogs_are_only_for_gms_and_admins(): void
    {
        $player = User::factory()->create();

        foreach (['/catalogos/talentos', '/catalogos/pericias', '/catalogos/poderes', '/catalogos/tracos', '/catalogos/itens'] as $uri) {
            $this->actingAs($player)->get($uri)->assertForbidden();
            $this->actingAs($this->gm)->get($uri)->assertOk();
        }

        $this->actingAs($this->gm)->get('/')->assertSee('Catálogos &amp; Regras', false);
        $this->actingAs($player)->get('/')->assertDontSee('Catálogos &amp; Regras', false);
    }

    public function test_urls_are_in_portuguese(): void
    {
        $this->assertSame(url('/catalogos/talentos/criar'), route('catalog.talents.create'));
        $this->actingAs($this->gm)->get('/catalogos/pericias/criar')->assertOk()->assertSee('Nova Perícia');
    }

    public function test_talent_needs_valid_attributes(): void
    {
        $this->actingAs($this->gm)->post(route('catalog.talents.store'), ['name' => 'Esquiva', 'composition' => []])
            ->assertSessionHasErrors('composition');
        $this->actingAs($this->gm)->post(route('catalog.talents.store'), ['name' => 'Esquiva', 'composition' => ['xyz']])
            ->assertSessionHasErrors('composition.0');

        $this->actingAs($this->gm)->post(route('catalog.talents.store'), [
            'name' => 'Esquiva',
            'category' => 'Combate',
            'composition' => ['agi', 'vel'],
        ])->assertRedirect(route('catalog.talents.index'));

        $talent = Talent::query()->firstOrFail();
        $this->assertSame(['agi', 'vel'], $talent->composition);
        $this->assertSame($this->gm->id, $talent->created_by);
        $this->actingAs($this->gm)->get('/catalogos/talentos?categoria=Combate')->assertSee('Esquiva')->assertSee('AGI');
    }

    public function test_skill_formula_is_validated(): void
    {
        $data = ['name' => 'Espadas', 'type' => 'Luta', 'purchase_cost' => 2, 'atp_cost' => 1, 'difficulty_formula' => '10 + FOR +'];

        $this->actingAs($this->gm)->post(route('catalog.skills.store'), $data)->assertSessionHasErrors('difficulty_formula');

        $this->actingAs($this->gm)->post(route('catalog.skills.store'), [...$data, 'difficulty_formula' => '10 + FOR'])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('skills', ['name' => 'Espadas', 'type' => 'Luta', 'difficulty_formula' => '10 + FOR', 'created_by' => $this->gm->id]);
    }

    public function test_skill_can_be_edited_and_deleted(): void
    {
        $skill = Skill::query()->create(['name' => 'Furtividade', 'type' => 'Geral', 'purchase_cost' => 1, 'atp_cost' => 0]);

        $this->actingAs($this->gm)->put(route('catalog.skills.update', $skill), [
            'name' => 'Furtividade Avançada', 'type' => 'Geral', 'purchase_cost' => 3, 'atp_cost' => 0,
        ])->assertRedirect(route('catalog.skills.index'));

        $this->assertSame('Furtividade Avançada', $skill->fresh()->name);

        // Excluir da base arquiva: sai do catálogo, mas as campanhas existentes ficam com a sua cópia.
        $this->actingAs($this->gm)->delete(route('catalog.skills.destroy', $skill))->assertSessionHas('status');
        $this->assertNotNull($skill->fresh()->archived_at);
        // Pela lista, não pelo HTML: o aviso "Perícia ... excluída da base" também cita o nome.
        $this->actingAs($this->gm)->get('/catalogos/pericias')
            ->assertViewHas('skills', static fn ($skills): bool => collect($skills->items())->doesntContain('id', $skill->id));
        $this->actingAs($this->gm)->get(route('catalog.skills.edit', $skill))->assertNotFound();
    }

    public function test_trait_target_can_be_attribute_or_talent(): void
    {
        $talent = Talent::query()->create(['name' => 'Esquiva', 'composition' => ['agi']]);

        $this->actingAs($this->gm)->post(route('catalog.traits.store'), [
            'name' => 'Força Bruta', 'type' => 'advantage', 'modifier' => 2, 'target' => 'attr:for', 'effect' => '+3 em Força',
        ])->assertSessionHasNoErrors();

        $this->actingAs($this->gm)->post(route('catalog.traits.store'), [
            'name' => 'Desajeitado', 'type' => 'disadvantage', 'modifier' => -2, 'target' => 'talent:'.$talent->id,
        ])->assertSessionHasNoErrors();

        $this->actingAs($this->gm)->post(route('catalog.traits.store'), [
            'name' => 'Inválido', 'type' => 'advantage', 'modifier' => 1, 'target' => 'talent:999',
        ])->assertSessionHasErrors('target');

        $strength = CharacterTrait::query()->where('name', 'Força Bruta')->firstOrFail();
        $clumsy = CharacterTrait::query()->where('name', 'Desajeitado')->firstOrFail();

        $this->assertSame('for', $strength->modifier_attribute);
        $this->assertNull($strength->modifier_talent_id);
        $this->assertSame($talent->id, $clumsy->modifier_talent_id);
        $this->assertSame(TraitType::Disadvantage, $clumsy->type);

        // Custo: modificador 2 + metade de 3 arredondada para cima = 4.
        $this->actingAs($this->gm)->get('/catalogos/tracos')->assertSee('4 pts')->assertSee('+2 em Força');
    }

    public function test_items_store_stats_image_and_compatible_weapons(): void
    {
        Storage::fake('public');
        $bow = CatalogItem::query()->create(['name' => 'Arco Longo', 'category' => 'weapons']);

        $this->actingAs($this->gm)->post(route('catalog.items.store'), [
            'name' => 'Flechas', 'category' => 'ammo', 'rarity' => 'Common', 'weight' => 0.5, 'value' => 10,
            'defense' => 0, 'stats' => ['for' => 0, 'agi' => 1], 'related' => [$bow->id],
            'image' => UploadedFile::fake()->create('flechas.png', 12, 'image/png'),
        ])->assertSessionHasNoErrors();

        $arrows = CatalogItem::query()->where('name', 'Flechas')->firstOrFail();

        $this->assertSame(['agi' => 1], $arrows->stats);
        $this->assertSame([$bow->id], $arrows->relatedItems()->pluck('catalog_items.id')->all());
        Storage::disk('public')->assertExists($arrows->image_path);

        // Fora da categoria munição, as armas compatíveis são ignoradas.
        $this->actingAs($this->gm)->post(route('catalog.items.store'), [
            'name' => 'Escudo', 'category' => 'armor', 'rarity' => 'Rare', 'weight' => 5, 'value' => 50,
            'defense' => 2, 'related' => [$bow->id],
        ])->assertSessionHasNoErrors();
        $this->assertSame(0, CatalogItem::query()->where('name', 'Escudo')->firstOrFail()->relatedItems()->count());
    }

    public function test_duplicated_item_shares_image_and_deleted_items_keep_it(): void
    {
        Storage::fake('public');
        $path = UploadedFile::fake()->create('espada.png', 12, 'image/png')->store('catalog', 'public');
        $sword = CatalogItem::query()->create(['name' => 'Espada', 'category' => 'weapons', 'image_path' => $path]);

        $this->actingAs($this->gm)->post(route('catalog.items.duplicate', $sword))->assertSessionHas('status');
        $copy = CatalogItem::query()->where('name', 'Espada (Cópia)')->firstOrFail();
        $this->assertSame($path, $copy->image_path);

        // Itens excluídos da base são arquivados (campanhas podem continuar com eles): a imagem fica.
        $this->actingAs($this->gm)->delete(route('catalog.items.destroy', $sword));
        $this->actingAs($this->gm)->delete(route('catalog.items.destroy', $copy));
        Storage::disk('public')->assertExists($path);
        $this->assertSame(0, CatalogItem::query()->base()->count());
    }

    public function test_suggestion_is_reviewed_and_approved(): void
    {
        $suggestion = $this->suggestion(SuggestionType::Power, [
            'name' => 'Bola de Fogo', 'type' => 'Elemental', 'effect' => '2D6 de dano', 'purchaseCost' => 3,
        ]);

        // Sugestões entram na base: só o administrador revisa.
        $this->actingAs($this->gm)->get(route('catalog.suggestions.review', $suggestion))->assertForbidden();

        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get(route('catalog.suggestions.review', $suggestion))
            ->assertRedirect(route('catalog.powers.create', ['sugestao' => $suggestion->id]));

        $this->actingAs($admin)->get(route('catalog.powers.create', ['sugestao' => $suggestion->id]))
            ->assertOk()
            ->assertSee('Revisar Sugestão de Poder')
            ->assertSee('value="Bola de Fogo"', false);

        $this->actingAs($admin)->post(route('catalog.powers.store'), [
            'suggestion_id' => $suggestion->id,
            'name' => 'Bola de Fogo Menor', 'type' => 'Elemental', 'purchase_cost' => 2, 'effect' => '1D6 de dano',
        ])->assertRedirect(route('admin.suggestions.index', ['origem' => 'jogadores']));

        $this->assertDatabaseHas('powers', ['name' => 'Bola de Fogo Menor', 'purchase_cost' => 2]);
        $suggestion->refresh();
        $this->assertSame(SuggestionStatus::Approved, $suggestion->status);
        $this->assertSame('Bola de Fogo Menor', $suggestion->data['name']);
    }

    public function test_trait_suggestion_with_legacy_attribute_target(): void
    {
        $suggestion = $this->suggestion(SuggestionType::Trait, [
            'name' => 'Olhos de Águia', 'type' => 'advantage', 'modifier' => 2, 'modifierType' => 'per',
        ]);

        $this->actingAs(User::factory()->admin()->create())->get(route('catalog.traits.create', ['sugestao' => $suggestion->id]))
            ->assertSee('value="attr:per" selected', false);
    }

    public function test_suggestion_can_be_rejected_but_not_reviewed_twice(): void
    {
        $suggestion = $this->suggestion(SuggestionType::Skill, ['name' => 'Culinária', 'type' => 'Geral']);
        $admin = User::factory()->admin()->create();

        $this->actingAs($this->gm)->put(route('catalog.suggestions.reject', $suggestion))->assertForbidden();
        $this->actingAs($admin)->put(route('catalog.suggestions.reject', $suggestion))->assertSessionHas('status');
        $this->assertSame(SuggestionStatus::Rejected, $suggestion->fresh()->status);

        $this->actingAs($admin)->get(route('catalog.suggestions.review', $suggestion))->assertSessionHasErrors('suggestion');
        $this->actingAs($admin)->get('/admin/sugestoes?origem=jogadores&status=rejected')->assertSee('Culinária');
        $this->actingAs($admin)->get('/admin/sugestoes?origem=jogadores')->assertDontSee('Culinária');
    }

    public function test_pending_suggestions_are_listed_in_the_admin_panel(): void
    {
        $this->suggestion(SuggestionType::Skill, ['name' => 'Culinária']);
        $this->suggestion(SuggestionType::Power, ['name' => 'Telecinese']);

        // O endereço antigo dos catálogos leva para o Painel Admin.
        $this->actingAs($this->gm)->get('/catalogos/sugestoes')->assertRedirect('/admin/sugestoes?origem=jogadores');
        $this->actingAs($this->gm)->get('/admin/sugestoes')->assertForbidden();

        $this->actingAs(User::factory()->admin()->create())->get('/admin')->assertSee('<span class="tabs__count">2</span>', false);
    }

    public function test_global_rules_tab_is_only_for_admins(): void
    {
        $this->actingAs($this->gm)->get('/catalogos/talentos')->assertDontSee('Configurações Base');
        $this->actingAs(User::factory()->admin()->create())->get('/catalogos/talentos')->assertSee('Configurações Base');

        $this->assertSame(0, Power::query()->count());
    }
}
