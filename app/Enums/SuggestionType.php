<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Traço, perícia e poder: sugeridos na criação de personagem, revisados pelo
 * administrador (entram na base). Item: sugerido do inventário, revisado pelo
 * mestre da campanha (entra na loja da campanha).
 */
enum SuggestionType: string
{
    case Trait = 'trait';
    case Skill = 'skill';
    case Power = 'power';
    case Item = 'item';

    public function label(): string
    {
        return match ($this) {
            self::Trait => 'Traço',
            self::Skill => 'Perícia',
            self::Power => 'Poder',
            self::Item => 'Item',
        };
    }
}
