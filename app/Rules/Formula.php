<?php

declare(strict_types=1);

namespace App\Rules;

use App\Game\FormulaEvaluator;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Fórmula de regra com sintaxe válida: números, variáveis (FOR, LUTA...),
 * parênteses e + - * / % ^.
 */
class Formula implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! (new FormulaEvaluator)->isValid($value)) {
            $fail('A fórmula do campo :attribute é inválida. Use números, variáveis (como FOR ou LUTA), parênteses e + - * / ^.');
        }
    }
}
