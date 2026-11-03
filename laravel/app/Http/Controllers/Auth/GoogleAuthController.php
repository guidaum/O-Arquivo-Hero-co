<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Login com Google (OAuth 2.0, fluxo "authorization code") usando apenas
 * o cliente HTTP do Laravel. Os dados do usuário vêm do endpoint userinfo
 * do Google, chamado no servidor com o access token.
 */
class GoogleAuthController extends Controller
{
    private const STATE_KEY = 'google_oauth_state';

    public static function isConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'))
            && filled(config('services.google.redirect'));
    }

    public function redirect(Request $request): RedirectResponse
    {
        if (! self::isConfigured()) {
            return $this->fail('auth.google_unavailable');
        }

        $state = Str::random(40);
        $request->session()->put(self::STATE_KEY, $state);

        $query = http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        return redirect()->away(config('services.google.authorize_url').'?'.$query);
    }

    public function callback(Request $request): RedirectResponse
    {
        $expectedState = $request->session()->pull(self::STATE_KEY);
        $state = $request->query('state');
        $code = $request->query('code');

        if (! self::isConfigured()
            || ! is_string($expectedState)
            || ! is_string($state)
            || ! hash_equals($expectedState, $state)
            || ! is_string($code)
            || $code === ''
        ) {
            return $this->fail('auth.google_failed');
        }

        $profile = $this->fetchProfile($code);

        if ($profile === null) {
            return $this->fail('auth.google_failed');
        }

        if (($profile['email_verified'] ?? false) !== true) {
            return $this->fail('auth.google_unverified');
        }

        $user = $this->findOrCreateUser($profile);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    /**
     * Troca o código pelo access token e busca o perfil do usuário.
     *
     * @return array<string, mixed>|null
     */
    private function fetchProfile(string $code): ?array
    {
        try {
            $token = Http::asForm()->timeout(10)->post((string) config('services.google.token_url'), [
                'code' => $code,
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'redirect_uri' => config('services.google.redirect'),
                'grant_type' => 'authorization_code',
            ]);

            $accessToken = $token->json('access_token');

            if ($token->failed() || ! is_string($accessToken)) {
                Log::warning('Google OAuth: falha ao trocar o código.', ['status' => $token->status()]);

                return null;
            }

            $userInfo = Http::withToken($accessToken)->timeout(10)->get((string) config('services.google.userinfo_url'));
        } catch (ConnectionException $exception) {
            Log::warning('Google OAuth: erro de conexão.', ['message' => $exception->getMessage()]);

            return null;
        }

        $profile = $userInfo->json();

        if ($userInfo->failed() || ! is_array($profile) || ! is_string($profile['sub'] ?? null) || ! is_string($profile['email'] ?? null)) {
            Log::warning('Google OAuth: perfil inválido.', ['status' => $userInfo->status()]);

            return null;
        }

        return $profile;
    }

    /**
     * Procura pela conta Google vinculada; depois pelo e-mail (usuários
     * importados do Firebase são vinculados no primeiro login); por fim,
     * cria uma conta nova de jogador.
     *
     * @param  array<string, mixed>  $profile
     */
    private function findOrCreateUser(array $profile): User
    {
        $googleId = (string) $profile['sub'];
        $email = Str::lower((string) $profile['email']);
        $picture = is_string($profile['picture'] ?? null) && mb_strlen($profile['picture']) <= 255 ? $profile['picture'] : null;

        $user = User::query()->where('google_id', $googleId)->first()
            ?? User::query()->where('email', $email)->first();

        if ($user === null) {
            $user = new User([
                'name' => is_string($profile['name'] ?? null) && $profile['name'] !== '' ? $profile['name'] : Str::before($email, '@'),
                'email' => $email,
                'photo_path' => $picture,
            ]);
            $user->role = UserRole::User;
        }

        $user->google_id = $googleId;
        $user->email_verified_at ??= now();
        $user->photo_path ??= $picture;
        $user->save();

        return $user;
    }

    private function fail(string $messageKey): RedirectResponse
    {
        return redirect()->route('login')->withErrors(['email' => __($messageKey)]);
    }
}
