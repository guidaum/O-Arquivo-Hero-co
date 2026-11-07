<?php

declare(strict_types=1);

namespace App\Enums;

enum AdvantageMode: string
{
    case Normal = 'normal';
    case Advantage = 'advantage';
    case Disadvantage = 'disadvantage';

    public function label(): string
    {
        return match ($this) {
            self::Normal => 'Normal',
            self::Advantage => 'Vantagem',
            self::Disadvantage => 'Desvantagem',
        };
    }
}
