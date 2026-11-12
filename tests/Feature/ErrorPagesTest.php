<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Character;
use App\Models\User;
use App\Support\HttpErrors;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Páginas de erro em português e mensagens JSON sem os padrões em inglês
 * do framework (App\Support\HttpErrors).
 */
class ErrorPagesTest extends TestCase
{
    use RefreshDatabase;

    private function characterOf(User $owner): Character
    {
        $character = new Character(['name' => 'Herói']);
        $character->user_id = $owner->id;
        $character->save();

        return $character;
    }

    public function test_unknown_page_shows_portuguese_error_page(): void
    {
        $this->get('/pagina-que-nao-existe')
            ->assertNotFound()
            ->assertSee('Página perdida nos arquivos')
            ->assertSee('Erro 404')
            ->assertDontSee('Not Found');
    }

    public function test_forbidden_page_uses_portuguese_message(): void
    {
        $character = $this->characterOf(User::factory()->create());

        $this->actingAs(User::factory()->create())
            ->get(route('characters.show', $character))
            ->assertForbidden()
            ->assertSee('Passagem selada')
            ->assertSee('Ir para o início')
            ->assertDontSee('This action is unauthorized.');
    }

    public function test_json_forbidden_message_is_in_portuguese(): void
    {
        $character = $this->characterOf(User::factory()->create());

        $this->actingAs(User::factory()->create())
            ->getJson(route('characters.notes.index', $character))
            ->assertForbidden()
            ->assertExactJson(['message' => HttpErrors::page(403)['message']]);
    }

    public function test_json_not_found_does_not_leak_model_names(): void
    {
        $response = $this->actingAs(User::factory()->create())
            ->getJson(route('characters.notes.index', 999999))
            ->assertNotFound()
            ->assertJsonPath('message', HttpErrors::page(404)['message']);

        $this->assertStringNotContainsString('App\\Models', $response->getContent());
    }

    public function test_custom_messages_are_kept_but_server_details_are_not(): void
    {
        $this->assertSame('Só o mestre coloca criaturas no mapa.', HttpErrors::message(403, new HttpException(403, 'Só o mestre coloca criaturas no mapa.')));
        $this->assertSame(HttpErrors::page(403)['message'], HttpErrors::message(403, new HttpException(403, 'This action is unauthorized.')));
        $this->assertSame(HttpErrors::page(500)['message'], HttpErrors::message(500, new HttpException(500, 'SQLSTATE[HY000] detalhes internos')));
        $this->assertSame(HttpErrors::page(500)['title'], HttpErrors::page(504)['title']);
    }
}
