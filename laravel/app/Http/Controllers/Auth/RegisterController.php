<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\RuleSet;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

class RegisterController extends Controller
{
    public function create(): View|RedirectResponse
    {
        if (! self::isEnabled()) {
            return redirect()->route('login')->withErrors(['email' => __('auth.registration_disabled')]);
        }

        return view('auth.register');
    }

    public function store(Request $request): RedirectResponse
    {
        if (! self::isEnabled()) {
            return redirect()->route('login')->withErrors(['email' => __('auth.registration_disabled')]);
        }

        $request->merge(['email' => Str::lower((string) $request->input('email'))]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = new User([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);
        $user->role = UserRole::User;
        $user->save();

        event(new Registered($user));

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('dashboard');
    }

    /**
     * Cadastro com e-mail e senha, controlado pela configuração global
     * (enable_email_password_auth). Sem configuração, fica liberado.
     */
    /**
     * Sem o login com Google, o cadastro por e-mail é a única forma de
     * entrar no sistema, então fica sempre aberto.
     */
    public static function isEnabled(): bool
    {
        if (! GoogleAuthController::isConfigured()) {
            return true;
        }

        return RuleSet::query()->global()->value('enable_email_password_auth') ?? true;
    }
}
