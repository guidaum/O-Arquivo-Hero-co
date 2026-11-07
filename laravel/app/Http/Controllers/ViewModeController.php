<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Enums\ViewMode;
use App\Support\Navigation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Alternador "Modo Mestre / Modo Jogador". Como no sistema antigo, para
 * quem não é admin o modo escolhido também passa a ser o papel da conta.
 */
class ViewModeController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'mode' => ['required', Rule::enum(ViewMode::class)],
        ]);

        $mode = ViewMode::from($data['mode']);
        $user = $request->user();

        $request->session()->put(Navigation::SESSION_KEY, $mode->value);

        if (! $user->isAdmin()) {
            $user->forceFill(['role' => $mode === ViewMode::Gm ? UserRole::Gm : UserRole::User])->save();
        }

        return redirect()->back(fallback: route('dashboard'));
    }
}
