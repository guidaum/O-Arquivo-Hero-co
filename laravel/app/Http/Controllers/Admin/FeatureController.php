<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\RoleFeature;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Aba "Recursos do Menu": funcionalidades visíveis para cada perfil.
 */
class FeatureController extends Controller
{
    public function edit(Request $request): View
    {
        $role = UserRole::tryFrom((string) $request->query('perfil')) ?? UserRole::User;

        $permissions = [];

        foreach (UserRole::cases() as $case) {
            foreach (array_keys(RoleFeature::DEFINITIONS) as $feature) {
                $permissions[$case->value][$feature] = RoleFeature::isEnabled($case, $feature);
            }
        }

        return view('admin.features', [
            'role' => $role,
            'permissions' => $permissions,
            'definitions' => RoleFeature::DEFINITIONS,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::enum(UserRole::class)],
            'features' => ['array'],
            'features.*' => ['string', Rule::in(array_keys(RoleFeature::DEFINITIONS))],
        ]);

        $role = UserRole::from($data['role']);
        $enabled = $data['features'] ?? [];

        DB::transaction(static function () use ($role, $enabled): void {
            foreach (array_keys(RoleFeature::DEFINITIONS) as $feature) {
                RoleFeature::query()->updateOrCreate(
                    ['role' => $role, 'feature' => $feature],
                    ['enabled' => in_array($feature, $enabled, true)],
                );
            }
        });

        return redirect()
            ->route('admin.features.edit', ['perfil' => $role->value])
            ->with('status', 'Permissões do perfil '.$role->label().' atualizadas com sucesso.');
    }

    /**
     * Volta todos os perfis aos padrões do sistema.
     */
    public function reset(Request $request): RedirectResponse
    {
        RoleFeature::query()->delete();

        return redirect()
            ->route('admin.features.edit', ['perfil' => $request->input('perfil')])
            ->with('status', 'Permissões restauradas para os padrões do sistema.');
    }
}
