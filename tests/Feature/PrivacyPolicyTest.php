<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrivacyPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_policy_is_public(): void
    {
        config(['arquivo.privacy.contact_email' => 'contato@example.com']);

        $this->get('/politica-de-privacidade')
            ->assertOk()
            ->assertSee('Política de Privacidade')
            ->assertSee('contato@example.com')
            ->assertSee('3 de novembro de 2026')
            ->assertSee('Voltar para o login');
    }

    public function test_policy_is_available_to_authenticated_users(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/politica-de-privacidade')
            ->assertOk()
            ->assertSee('Voltar ao início');
    }

    public function test_ai_service_is_mentioned_only_when_configured(): void
    {
        $this->get('/politica-de-privacidade')->assertDontSee('inteligência artificial');

        config(['arquivo.privacy.ai_maps_service' => 'Serviço de Exemplo']);

        $this->get('/politica-de-privacidade')->assertSee('Serviço de Exemplo');
    }

    public function test_login_and_app_pages_link_to_the_policy(): void
    {
        $this->get('/login')->assertSee(route('privacy'));

        $this->actingAs(User::factory()->create())->get('/')->assertSee(route('privacy'));
    }
}
