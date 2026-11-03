<?php

declare(strict_types=1);

namespace App\Enums;

enum TraitType: string
{
    case Advantage = 'advantage';
    case Disadvantage = 'disadvantage';

    public function label(): string
    {
        return match ($this) {
            self::Advantage => 'Vantagem',
            self::Disadvantage => 'Desvantagem',
        };
    }
}
