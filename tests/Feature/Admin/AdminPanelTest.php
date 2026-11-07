<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Character;
use App\Models\GameSession;
use App\Models\RoleFeature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Painel Admin (AdminDashboard.tsx e FeatureManagerTab.tsx do sistema antigo).
 */
class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create(['name' => 'Admin Exemplo']);
    }

    private function sessionOf(User $gm, string $name = 'Crônicas de Eldoria'): GameSession
    {
        $session = new GameSession(['name' => $name, 'code' => strtoupper(substr(md5($name), 0, 6))]);
        $session->gm_id = $gm->id;
        $session->save();

        return $session;
    }

    private function characterOf(?User $owner, string $name = 'Alden'): Character
    {
        $character = new Character(['name' => $name, 'class' => 'Paladino']);
        $character->user_id = $owner?->id;
        $character->save();

        return $character;
    }

    public function test_only_admins_can_open_the_panel(): void
    {
        $gm = User::factory()->gm()->create();

        foreach (['/admin', '/admin/recursos', '/admin/usuarios', '/admin/personagens', '/admin/sessoes'] as $uri) {
            $this->actingAs($gm)->get($uri)->assertForbidden();
            $this->actingAs($this->admin)->get($uri)->assertOk()->assertSee('Painel do Administrador');
        }

        $this->actingAs($gm)->delete(route('admin.users.destroy', User::factory()->create()))->assertForbidden();
    }

    public function test_dashboard_shows_system_totals(): void
    {
        $gm = User::factory()->gm()->create(['last_active_at' => now()->subHours(2)]);
        User::factory()->create(['last_active_at' => now()->subDays(3)]);
        $this->sessionOf($gm);
        $this->characterOf($gm);

        // O próprio admin conta como ativo: o acesso ao painel registra a atividade dele.
        $this->actingAs($this->admin)->get('/admin')
            ->assertSee('Ativos nas últimas 24h')
            ->assertViewHas('stats', ['users' => 3, 'characters' => 1, 'sessions' => 1, 'activeToday' => 2]);
    }

    public function test_menu_features_can_be_turned_off_per_role(): void
    {
        $enabled = array_values(array_diff(array_keys(RoleFeature::DEFINITIONS), ['journal', 'inventory']));

        $this->actingAs($this->admin)
            ->put(route('admin.features.update'), ['role' => 'user', 'features' => $enabled])
            ->assertRedirect(route('admin.features.edit', ['perfil' => 'user']))
            ->assertSessionHas('status');

        $this->assertFalse(RoleFeature::isEnabled(UserRole::User, 'journal'));
        $this->assertTrue(RoleFeature::isEnabled(UserRole::User, 'worldMap'));
        $this->assertTrue(RoleFeature::isEnabled(UserRole::Gm, 'journal'));

        $this->actingAs(User::factory()->create())->get('/')->assertDontSee('Diário de Sessão')->assertDontSee('Inventário');
    }

    public function test_features_page_reflects_saved_permissions(): void
    {
        RoleFeature::query()->create(['role' => UserRole::Gm, 'feature' => 'dungeon', 'enabled' => false]);

        // Mestre: Painel Admin desligado por padrão + dungeon desligado = 7 de 9.
        $this->actingAs($this->admin)->get('/admin/recursos?perfil=gm')
            ->assertOk()
            ->assertSee('Editando permissões para')
            ->assertSee('7/9')
            ->assertDontSee('value="dungeon" checked', false);
    }

    public function test_unknown_feature_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->put(route('admin.features.update'), ['role' => 'user', 'features' => ['hackear']])
            ->assertSessionHasErrors('features.0');
    }

    public function test_restoring_defaults_clears_saved_permissions(): void
    {
        RoleFeature::query()->create(['role' => UserRole::User, 'feature' => 'journal', 'enabled' => false]);
        RoleFeature::query()->create(['role' => UserRole::User, 'feature' => 'mapManager', 'enabled' => true]);

        $this->actingAs($this->admin)->delete(route('admin.features.reset'), ['perfil' => 'user'])->assertSessionHas('status');

        $this->assertSame(0, RoleFeature::query()->count());
        $this->assertTrue(RoleFeature::isEnabled(UserRole::User, 'journal'));
        $this->assertFalse(RoleFeature::isEnabled(UserRole::User, 'mapManager'));
    }

    public function test_users_can_be_searched_and_filtered_by_role(): void
    {
        User::factory()->gm()->create(['name' => 'Mestra Lúcia', 'email' => 'lucia@example.com']);
        User::factory()->create(['name' => 'Jogador Bruno', 'email' => 'bruno@example.com']);

        $this->actingAs($this->admin)->get('/admin/usuarios?busca=lucia')
            ->assertSee('Mestra Lúcia')
            ->assertDontSee('Jogador Bruno');

        $this->actingAs($this->admin)->get('/admin/usuarios?papel=user')
            ->assertSee('Jogador Bruno')
            ->assertDontSee('Mestra Lúcia');
    }

    public function test_admin_changes_another_users_role(): void
    {
        $player = User::factory()->create();

        $this->actingAs($this->admin)->put(route('admin.users.role', $player), ['role' => 'gm'])->assertSessionHas('status');

        $this->assertSame(UserRole::Gm, $player->fresh()->role);
    }

    public function test_admin_can_not_change_own_role_or_delete_own_account(): void
    {
        $this->actingAs($this->admin)->put(route('admin.users.role', $this->admin), ['role' => 'user'])->assertSessionHasErrors('role');
        $this->actingAs($this->admin)->delete(route('admin.users.destroy', $this->admin))->assertSessionHasErrors('user');

        $this->assertSame(UserRole::Admin, $this->admin->fresh()->role);
    }

    public function test_deleting_a_user_keeps_their_characters_without_owner(): void
    {
        $player = User::factory()->create();
        $character = $this->characterOf($player);

        $this->actingAs($this->admin)->delete(route('admin.users.destroy', $player))->assertSessionHas('status');

        $this->assertModelMissing($player);
        $this->assertNull($character->fresh()->user_id);
        $this->actingAs($this->admin)->get('/admin/personagens')->assertSee('Sem dono');
    }

    public function test_characters_and_sessions_can_be_deleted(): void
    {
        $gm = User::factory()->gm()->create();
        $session = $this->sessionOf($gm);
        $character = $this->characterOf($gm);

        $this->actingAs($this->admin)->get('/admin/sessoes')->assertSee('Crônicas de Eldoria')->assertSee($gm->name);

        $this->actingAs($this->admin)->delete(route('admin.characters.destroy', $character))->assertSessionHas('status');
        $this->actingAs($this->admin)->delete(route('admin.sessions.destroy', $session))->assertSessionHas('status');

        $this->assertModelMissing($character);
        $this->assertModelMissing($session);
    }

    public function test_lists_are_paginated(): void
    {
        User::factory()->count(25)->create();

        $this->actingAs($this->admin)->get('/admin/usuarios')->assertSee('Próxima')->assertSee('?page=2', false);
    }
}
