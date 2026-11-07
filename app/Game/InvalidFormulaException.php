<?php

declare(strict_types=1);

namespace App\Game;

use InvalidArgumentException;

/**
 * Fórmula com sintaxe inválida ou resultado impossível de calcular.
 */
class InvalidFormulaException extends InvalidArgumentException
{
    public static function at(string $expression, string $reason): self
    {
        return new self(sprintf('Fórmula inválida "%s": %s.', mb_substr($expression, 0, 80), $reason));
    }
}
