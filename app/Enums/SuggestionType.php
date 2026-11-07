<?php

declare(strict_types=1);

namespace App\Enums;

enum SuggestionType: string
{
    case Trait = 'trait';
    case Skill = 'skill';
    case Power = 'power';

    public function label(): string
    {
        return match ($this) {
            self::Trait => 'Traço',
            self::Skill => 'Perícia',
            self::Power => 'Poder',
        };
    }
}
