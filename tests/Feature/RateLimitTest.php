<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Support\HttpErrors;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Limites nomeados (AppServiceProvider::configureRateLimiting) e a resposta
 * 429 em português.
 */
class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_is_limited_per_ip(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->post(route('register.store'), ['name' => '', 'email' => 'invalido'])->assertRedirect();
        }

        $this->post(route('register.store'), ['name' => '', 'email' => 'invalido'])
            ->assertTooManyRequests()
            ->assertSee('Calma, aventureiro');
    }

    public function test_rolls_answer_json_in_portuguese_when_limited(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < 60; $i++) {
            $this->actingAs($user)->postJson(route('dice.roll'), ['sides' => 20, 'quantity' => 1]);
        }

        $this->actingAs($user)->postJson(route('dice.roll'), ['sides' => 20, 'quantity' => 1])
            ->assertTooManyRequests()
            ->assertJsonPath('message', HttpErrors::page(429)['message']);
    }
}
