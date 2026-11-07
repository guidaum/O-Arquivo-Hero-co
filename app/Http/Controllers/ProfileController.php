<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

class ProfileController extends Controller
{
    public function edit(Request $request): View
    {
        return view('profile.edit', [
            'user' => $request->user(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'location' => ['nullable', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:32'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            // Como no sistema antigo: o usuário alterna entre jogador e mestre, mas nunca vira admin.
            'role' => [$user->isAdmin() ? 'prohibited' : 'required', Rule::in([UserRole::User->value, UserRole::Gm->value])],
        ]);

        $user->fill([
            'name' => $data['name'],
            'bio' => $data['bio'] ?? null,
            'location' => $data['location'] ?? null,
            'phone_number' => $data['phone_number'] ?? null,
        ]);

        if (! $user->isAdmin()) {
            $user->role = UserRole::from($data['role']);
        }

        if ($request->hasFile('photo')) {
            $this->deleteStoredPhoto($user->photo_path);
            $user->photo_path = $request->file('photo')->store('avatars', 'public');
        }

        $user->save();

        return redirect()->route('profile.edit')->with('status', 'Perfil atualizado.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        // Contas sem senha (importadas ou criadas pelo Google) definem a primeira senha aqui.
        $request->validateWithBag('password', [
            'current_password' => [$user->needsPasswordSetup() ? 'nullable' : 'required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user->password = (string) $request->input('password');
        $user->save();

        return redirect()->route('profile.edit')->with('status', 'Senha atualizada.');
    }

    /**
     * Remove a foto anterior apenas se for um arquivo nosso (não uma URL externa).
     */
    private function deleteStoredPhoto(?string $path): void
    {
        if ($path !== null && $path !== '' && ! Str::startsWith($path, ['http://', 'https://'])) {
            Storage::disk('public')->delete($path);
        }
    }
}
