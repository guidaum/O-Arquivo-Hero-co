<?php

declare(strict_types=1);

namespace App\Enums;

enum RollOutcome: string
{
    case Critical = 'critical';
    case Fumble = 'fumble';
    case Success = 'success';
    case Failure = 'failure';

    public function label(): string
    {
        return match ($this) {
            self::Critical => 'Acerto Crítico!',
            self::Fumble => 'Falha Crítica!',
            self::Success => 'Sucesso!',
            self::Failure => 'Falha!',
        };
    }
}
