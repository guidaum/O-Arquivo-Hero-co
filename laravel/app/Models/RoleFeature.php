<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Funcionalidade do menu liberada ou não para um papel.
 */
#[Fillable(['role', 'feature', 'enabled'])]
class RoleFeature extends Model
{
    /**
     * Funcionalidades sem registro ficam liberadas, como no sistema antigo.
     * A tabela é lida uma única vez por requisição.
     */
    public static function isEnabled(UserRole $role, string $feature): bool
    {
        $flags = once(static fn (): array => self::query()
            ->get(['role', 'feature', 'enabled'])
            ->mapWithKeys(static fn (self $flag): array => [$flag->role->value.'.'.$flag->feature => $flag->enabled])
            ->all());

        return $flags[$role->value.'.'.$feature] ?? true;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'enabled' => 'boolean',
        ];
    }
}
