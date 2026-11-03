<?php

declare(strict_types=1);

namespace App\Enums;

enum TokenType: string
{
    case Player = 'player';
    case Monster = 'monster';
    case Npc = 'npc';

    public function label(): string
    {
        return match ($this) {
            self::Player => 'Jogador',
            self::Monster => 'Monstro',
            self::Npc => 'NPC',
        };
    }
}
