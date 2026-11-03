<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\View\View;

/**
 * "Esqueci minha senha" e "Primeiro acesso" (usuários importados sem senha).
 */
class PasswordResetLinkController extends Controller
{
    public function create(Request $request): View
    {
        return view('auth.forgot-password', [
            'firstAccess' => $request->boolean('primeiro-acesso'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $status = Password::sendResetLink([
            'email' => Str::lower((string) $request->input('email')),
        ]);

        if ($status === Password::RESET_THROTTLED) {
            return back()->withInput()->withErrors(['email' => __($status)]);
        }

        // Mesma resposta para e-mail existente ou não, para não revelar quem tem conta.
        return back()->with('status', __(Password::RESET_LINK_SENT));
    }
}
