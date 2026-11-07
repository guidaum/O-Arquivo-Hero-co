<?php

declare(strict_types=1);

namespace App\Enums;

enum MapType: string
{
    case World = 'world';
    case Dungeon = 'dungeon';

    public function label(): string
    {
        return match ($this) {
            self::World => 'Mapa do mundo',
            self::Dungeon => 'Masmorra',
        };
    }
}
