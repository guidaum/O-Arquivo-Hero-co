<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_displayed(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/perfil')->assertOk()->assertSee('Meu perfil');
    }

    public function test_user_can_switch_between_player_and_gm(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put('/perfil', ['name' => 'Novo Nome', 'role' => 'gm'])
            ->assertRedirect('/perfil')
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame('Novo Nome', $user->name);
        $this->assertSame(UserRole::Gm, $user->role);
    }

    public function test_user_can_not_become_admin(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put('/perfil', ['name' => $user->name, 'role' => 'admin'])
            ->assertSessionHasErrors('role');

        $this->assertSame(UserRole::User, $user->fresh()->role);
    }

    public function test_admin_role_is_preserved_on_profile_update(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->put('/perfil', ['name' => 'Admin'])->assertSessionHasNoErrors();

        $this->assertSame(UserRole::Admin, $admin->fresh()->role);
    }

    public function test_user_without_password_can_define_one_without_current_password(): void
    {
        $user = User::factory()->withoutPassword()->create();

        $this->actingAs($user)->put('/perfil/senha', [
            'password' => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('nova-senha-123', $user->fresh()->password));
    }

    public function test_changing_password_requires_current_password(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put('/perfil/senha', [
            'current_password' => 'senha-errada',
            'password' => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasErrorsIn('password', 'current_password');

        $this->assertTrue(Hash::check('senha-segura-123', $user->fresh()->password));
    }
}
