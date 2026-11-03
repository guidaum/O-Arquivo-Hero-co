<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Colunas *_path guardam um caminho no disco "public" ou, para dados
 * importados do Firebase, uma URL externa. Este trait devolve sempre
 * uma URL pronta para uso na view.
 */
trait HasPublicFiles
{
    protected function publicFileUrl(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        return Storage::disk('public')->url($path);
    }
}
