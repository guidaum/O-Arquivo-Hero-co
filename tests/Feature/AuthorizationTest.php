<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\SuggestionStatus;
use App\Enums\SuggestionType;
use App\Enums\UserRole;
use App\Models\Character;
use App\Models\GameSession;
use App\Models\RoleFeature;
use App\Models\Skill;
use App\Models\Suggestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Regras equivalentes às das firestore.rules do sistema antigo.
 */
class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private User $gm;

    private User $player;

    private User $outsider;

    private GameSession $session;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gm = User::factory()->gm()->create();
        $this->player = User::factory()->create();
        $this->outsider = User::factory()->create();

        $this->session = new GameSession(['name' => 'Campanha de Teste', 'code' => 'ABC123']);
        $this->session->gm_id = $this->gm->id;
        $this->session->save();
        $this->session->players()->attach($this->player);
    }

    private function characterOf(User $owner, bool $canEditStats = false): Character
    {
        $character = new Character(['name' => 'Herói']);
        $character->user_id = $owner->id;
        $character->game_session_id = $this->session->id;
        $character->can_edit_stats = $canEditStats;
        $character->save();

        return $character;
    }

    public function test_session_is_visible_only_to_gm_players_and_admin(): void
    {
        $this->assertTrue($this->gm->can('view', $this->session));
        $this->assertTrue($this->player->can('view', $this->session));
        $this->assertFalse($this->outsider->can('view', $this->session));
        $this->assertTrue(User::factory()->admin()->create()->can('view', $this->session));
    }

    public function test_only_the_session_gm_can_manage_it(): void
    {
        $this->assertTrue($this->gm->can('update', $this->session));
        $this->assertFalse($this->player->can('update', $this->session));
        $this->assertFalse(User::factory()->gm()->create()->can('update', $this->session));
    }

    public function test_character_visibility_follows_the_session(): void
    {
        $other = User::factory()->create();
        $this->session->players()->attach($other);
        $character = $this->characterOf($this->player);

        $this->assertTrue($this->player->can('view', $character));
        $this->assertTrue($this->gm->can('view', $character));
        $this->assertTrue($other->can('view', $character));
        $this->assertFalse($this->outsider->can('view', $character));
    }

    public function test_character_stats_are_locked_until_gm_unlocks(): void
    {
        $locked = $this->characterOf($this->player);
        $unlocked = $this->characterOf($this->player, canEditStats: true);

        $this->assertTrue($this->player->can('update', $locked));
        $this->assertFalse($this->player->can('editStats', $locked));
        $this->assertTrue($this->player->can('editStats', $unlocked));
        $this->assertTrue($this->gm->can('editStats', $locked));
        $this->assertFalse($this->player->can('unlockStats', $locked));
        $this->assertTrue($this->gm->can('unlockStats', $locked));
    }

    public function test_only_owner_deletes_character(): void
    {
        $character = $this->characterOf($this->player);

        $this->assertTrue($this->player->can('delete', $character));
        $this->assertFalse($this->gm->can('delete', $character));
    }

    public function test_game_content_is_writable_only_by_gms(): void
    {
        $this->assertTrue($this->player->can('viewAny', Skill::class));
        $this->assertFalse($this->player->can('create', Skill::class));
        $this->assertTrue($this->gm->can('create', Skill::class));
    }

    public function test_pending_suggestion_can_be_withdrawn_by_author_only(): void
    {
        $suggestion = new Suggestion(['type' => SuggestionType::Skill, 'data' => ['name' => 'Nova perícia']]);
        $suggestion->user_id = $this->player->id;
        $suggestion->status = SuggestionStatus::Pending;
        $suggestion->save();

        $this->assertTrue($this->player->can('delete', $suggestion));
        $this->assertFalse($this->outsider->can('delete', $suggestion));
        $this->assertTrue($this->gm->can('review', $suggestion));
        $this->assertFalse($this->player->can('review', $suggestion));
    }

    public function test_role_middleware_blocks_players(): void
    {
        Route::middleware(['web', 'auth', 'role:gm'])->get('/_teste/mestre', fn (): string => 'ok');

        $this->actingAs($this->player)->get('/_teste/mestre')->assertForbidden();
        $this->actingAs($this->gm)->get('/_teste/mestre')->assertOk();
        $this->actingAs(User::factory()->admin()->create())->get('/_teste/mestre')->assertOk();
    }

    public function test_menu_features_follow_role_settings(): void
    {
        RoleFeature::query()->create(['role' => UserRole::User, 'feature' => 'dungeon', 'enabled' => false]);

        $this->assertFalse($this->player->can('use-feature', 'dungeon'));
        $this->assertTrue($this->player->can('use-feature', 'journal'));
        $this->assertTrue($this->gm->can('use-feature', 'dungeon'));
    }
}
