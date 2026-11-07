<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\GameSession;
use App\Models\User;
use Illuminate\View\View;

/**
 * Aba "Dashboard" do Painel Admin: totais do sistema.
 */
class DashboardController extends Controller
{
    public function __invoke(): View
    {
        return view('admin.dashboard', [
            'stats' => [
                'users' => User::query()->count(),
                'characters' => Character::query()->count(),
                'sessions' => GameSession::query()->count(),
                'activeToday' => User::query()->where('last_active_at', '>=', now()->subDay())->count(),
            ],
        ]);
    }
}
