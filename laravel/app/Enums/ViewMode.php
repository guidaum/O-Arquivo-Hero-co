<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Interface exibida: Mestre ou Jogador. Só muda o que aparece na tela;
 * as permissões continuam vindo do papel do usuário.
 */
enum ViewMode: string
{
    case Gm = 'gm';
    case Player = 'user';

    public function label(): string
    {
        return match ($this) {
            self::Gm => 'Mestre',
            self::Player => 'Jogador',
        };
    }
}
