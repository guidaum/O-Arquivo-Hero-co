<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\ViewMode;
use App\Models\Character;
use App\Models\GameSession;
use App\Models\RoleFeature;
use App\Models\User;
use App\Support\Navigation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Layout base: menu por papel e modo de visão (regras do Layout.tsx do
 * sistema antigo), alternador Mestre/Jogador e página inicial.
 */
class LayoutTest extends TestCase
{
    use RefreshDatabase;

    private const PLAYER_MENU = [
        'Minhas Lendas', 'Diário de Sessão', 'Dungeons &amp; Tokens', 'Mapa do Mundo',
        'Inventário', 'Criação de Personagem', 'Ficha Geral',
    ];

    private function sessionOf(User $gm, string $name = 'Crônicas de Eldoria'): GameSession
    {
        $session = new GameSession(['name' => $name, 'code' => strtoupper(substr(md5($name), 0, 6))]);
        $session->gm_id = $gm->id;
        $session->save();

        return $session;
    }

    public function test_player_sees_only_player_menu(): void
    {
        $response = $this->actingAs(User::factory()->create())->get('/')->assertOk();

        foreach (self::PLAYER_MENU as $label) {
            $response->assertSee($label, false);
        }

        $response->assertDontSee('Gerenciador de Mapas')->assertDontSee('Painel Admin');
    }

    public function test_gm_in_gm_mode_sees_map_manager(): void
    {
        $this->actingAs(User::factory()->gm()->create())->get('/')
            ->assertOk()
            ->assertSee('Painel do Mestre')
            ->assertSee('Gerenciador de Mapas')
            ->assertDontSee('Painel Admin');
    }

    public function test_admin_sees_admin_panel_only_in_gm_mode(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->get('/')->assertSee('Painel Admin');
        $this->actingAs($admin)->withSession([Navigation::SESSION_KEY => 'user'])->get('/')
            ->assertDontSee('Painel Admin')
            ->assertDontSee('Gerenciador de Mapas');
    }

    public function test_switching_mode_changes_role_like_the_old_system(): void
    {
        $gm = User::factory()->gm()->create();

        $this->actingAs($gm)->put('/modo-de-visao', ['mode' => 'user'])
            ->assertRedirect()
            ->assertSessionHas(Navigation::SESSION_KEY, 'user');

        $this->assertSame(UserRole::User, $gm->fresh()->role);
        $this->actingAs($gm->fresh())->get('/')->assertSee('Minhas Lendas')->assertDontSee('Gerenciador de Mapas');

        $this->actingAs($gm->fresh())->put('/modo-de-visao', ['mode' => 'gm']);
        $this->assertSame(UserRole::Gm, $gm->fresh()->role);
    }

    public function test_admin_keeps_admin_role_when_switching_mode(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->put('/modo-de-visao', ['mode' => 'user'])->assertSessionHas(Navigation::SESSION_KEY, 'user');

        $this->assertSame(UserRole::Admin, $admin->fresh()->role);
    }

    public function test_invalid_mode_is_rejected(): void
    {
        $this->actingAs(User::factory()->create())->put('/modo-de-visao', ['mode' => 'admin'])->assertSessionHasErrors('mode');
    }

    public function test_disabled_feature_is_hidden_and_blocked(): void
    {
        RoleFeature::query()->create(['role' => UserRole::User, 'feature' => 'journal', 'enabled' => false]);
        $player = User::factory()->create();

        $this->actingAs($player)->get('/')->assertDontSee('Diário de Sessão');
        $this->actingAs($player)->get('/diario')->assertForbidden();
    }

    public function test_every_module_has_its_own_page(): void
    {
        // Todos os módulos foram convertidos: nenhuma rota usa mais a página "em construção".
        $this->actingAs(User::factory()->create())->get('/dungeon')
            ->assertOk()
            ->assertDontSee('Em construção')
            ->assertSee('Você ainda não participa de nenhuma campanha');
    }

    public function test_map_manager_and_admin_panel_follow_default_permissions(): void
    {
        $this->actingAs(User::factory()->create())->get('/mapas')->assertForbidden();
        $this->actingAs(User::factory()->gm()->create())->get('/mapas')->assertOk();
        $this->actingAs(User::factory()->gm()->create())->get('/admin')->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->get('/admin')->assertOk();
    }

    public function test_gm_panel_is_only_for_the_session_gm(): void
    {
        $gm = User::factory()->gm()->create();
        $session = $this->sessionOf($gm);

        $this->actingAs($gm)->get(route('gm.sessions.show', $session))->assertOk()->assertSee($session->name);
        $this->actingAs(User::factory()->gm()->create())->get(route('gm.sessions.show', $session))->assertForbidden();
    }

    public function test_gm_dashboard_lists_campaigns_and_characters(): void
    {
        $gm = User::factory()->gm()->create();
        $session = $this->sessionOf($gm);
        $session->players()->attach(User::factory()->create());

        $character = new Character(['name' => 'Alden', 'class' => 'Paladino', 'level' => 3, 'stats' => ['for' => 12]]);
        $character->user_id = $gm->id;
        $character->save();

        $this->actingAs($gm)->get('/')
            ->assertSee('Minhas Campanhas Ativas')
            ->assertSee('Crônicas de Eldoria')
            ->assertSee('Código: '.$session->code)
            ->assertSee('1 Jogador')
            ->assertSee('Alden')
            ->assertSee('Nível 3 • Paladino')
            ->assertSee(route('characters.show', $character), false)
            ->assertSee(route('gm.sessions.show', $session), false);
    }

    public function test_character_card_shows_the_sheet_totals(): void
    {
        $player = User::factory()->create();

        // Formato importado (chave maiúscula) + modificador e ajuste do mestre: a ficha soma tudo.
        $character = new Character(['name' => 'Alden', 'stats' => ['FOR' => 4, 'con' => 3], 'stats_mods' => ['for' => 2]]);
        $character->user_id = $player->id;
        $character->gm_modifiers = ['con' => [['id' => 'a1', 'value' => 1, 'justification' => 'Bênção']]];
        $character->save();

        $this->actingAs($player)->get('/')
            ->assertOk()
            ->assertSeeInOrder(['FOR', '6', 'CON', '4', 'AGI', '0'], false);
    }

    public function test_player_dashboard_lists_joined_campaigns_with_gm(): void
    {
        $gm = User::factory()->gm()->create(['name' => 'Mestre Exemplo']);
        $player = User::factory()->create();
        $this->sessionOf($gm)->players()->attach($player);

        $this->actingAs($player)->get('/')
            ->assertSee('Interface do Jogador')
            ->assertSee('Crônicas de Eldoria')
            ->assertSee('Mestre: Mestre Exemplo');
    }

    public function test_player_who_masters_a_campaign_can_use_gm_mode(): void
    {
        $player = User::factory()->create();
        $this->sessionOf($player);

        $this->actingAs($player)->withSession([Navigation::SESSION_KEY => 'gm'])->get('/')
            ->assertSee('Painel do Mestre')
            ->assertSee('Minhas Campanhas Ativas');

        // Sem campanhas mestradas, o modo Mestre salvo não vale para um jogador.
        $this->actingAs(User::factory()->create())->withSession([Navigation::SESSION_KEY => 'gm'])->get('/')
            ->assertSee('Interface do Jogador');
    }

    public function test_menu_is_grouped_by_context(): void
    {
        $this->actingAs(User::factory()->create())->get('/')
            ->assertOk()
            ->assertSeeInOrder(['Personagens', 'Minhas Lendas', 'Ficha Geral', 'Mesa de Jogo', 'Diário de Sessão'], false)
            ->assertDontSee('Ferramentas do Mestre');

        $this->actingAs(User::factory()->gm()->create())->get('/')
            ->assertSee('Ferramentas do Mestre');
    }

    public function test_bottom_bar_shortcuts_follow_view_mode_and_current_page(): void
    {
        $none = static fn (array $item): bool => false;

        $player = new Navigation(User::factory()->create(), ViewMode::Player);
        $this->assertSame(
            ['legends', 'characterSheet', 'inventory', 'journal'],
            array_column($player->shortcuts($none), 'feature'),
        );

        // A tela atual sempre aparece na barra, no lugar do último atalho.
        $onDungeon = static fn (array $item): bool => $item['feature'] === 'dungeon';
        $this->assertSame(
            ['legends', 'characterSheet', 'inventory', 'dungeon'],
            array_column($player->shortcuts($onDungeon), 'feature'),
        );

        $gm = new Navigation(User::factory()->gm()->create(), ViewMode::Gm);
        $this->assertSame(
            ['legends', 'journal', 'dungeon', 'mapManager'],
            array_column($gm->shortcuts($none), 'feature'),
        );
    }

    public function test_disabled_shortcut_is_replaced_by_the_next_item(): void
    {
        RoleFeature::query()->create(['role' => UserRole::User, 'feature' => 'inventory', 'enabled' => false]);

        $player = new Navigation(User::factory()->create(), ViewMode::Player);

        $this->assertSame(
            ['legends', 'characterSheet', 'journal', 'dungeon'],
            array_column($player->shortcuts(static fn (array $item): bool => false), 'feature'),
        );
    }

    public function test_drawer_has_account_actions_for_small_screens(): void
    {
        $this->actingAs(User::factory()->create())->get('/')
            ->assertOk()
            ->assertSee('Pular para o conteúdo')
            ->assertSee('sidebar__account', false)
            ->assertSee('Sair da Sessão')
            ->assertSee('data-sidebar-toggle aria-controls="sidebar"', false);
    }

    public function test_page_header_back_link(): void
    {
        $this->blade('<x-page-header title="Loja" back="/inventario/1" back-label="Voltar ao Inventário" />')
            ->assertSee('href="/inventario/1"', false)
            ->assertSee('Voltar ao Inventário')
            ->assertSee('page-header__back', false);

        $this->blade('<x-page-header title="Loja" />')->assertDontSee('page-header__back', false);
    }

    public function test_modal_component(): void
    {
        $this->blade('<x-modal id="exemplo" title="Nova Campanha">Conteúdo</x-modal>')
            ->assertSee('id="exemplo"', false)
            ->assertSee('Nova Campanha')
            ->assertSee('data-modal-close', false);
    }

    public function test_static_files_are_versioned_for_caches(): void
    {
        $css = 'css/app.css?v='.filemtime(public_path('css/app.css'));
        $responsive = 'css/responsive.css?v='.filemtime(public_path('css/responsive.css'));
        $http = 'js/core/http.js?v='.filemtime(public_path('js/core/http.js'));

        // Módulos importados por caminho relativo também recebem a versão (import map).
        $this->actingAs(User::factory()->create())->get('/')
            ->assertOk()
            ->assertSee($css, false)
            ->assertSee($responsive, false)
            ->assertSee('<script type="importmap">', false)
            ->assertSee(str_replace('/', '\/', $http), false);
    }
}
