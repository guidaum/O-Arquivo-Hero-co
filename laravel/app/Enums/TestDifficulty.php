<?php

declare(strict_types=1);

namespace App\Enums;

enum TestDifficulty: string
{
    case Easy = 'easy';
    case Normal = 'normal';
    case Hard = 'hard';
    case Extreme = 'extreme';

    public function label(): string
    {
        return match ($this) {
            self::Easy => 'Fácil',
            self::Normal => 'Normal',
            self::Hard => 'Difícil',
            self::Extreme => 'Extremo',
        };
    }
}
