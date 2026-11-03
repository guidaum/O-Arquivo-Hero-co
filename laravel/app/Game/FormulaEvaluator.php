<?php

declare(strict_types=1);

namespace App\Game;

use Illuminate\Support\Str;

/**
 * Avalia as fórmulas configuráveis das regras (PV, ATP, defesa, custos,
 * dificuldade de perícias...) com variáveis como FOR, AGI ou LUTA.
 *
 * Equivale a evaluateFormula/resolveStatsWithVars do sistema antigo, com
 * duas diferenças intencionais: nunca usa eval() e ignora acentos e
 * maiúsculas nos nomes das variáveis ("Mística" e "MISTICA" são iguais).
 * Fórmulas inválidas valem 0, como no sistema antigo.
 */
final class FormulaEvaluator
{
    /** Nome de variável que não faz parte de outra palavra ou número. */
    private const IDENTIFIER = '/(?<![A-Z0-9_.])[A-Z_][A-Z0-9_]*/';

    /** Quantas vezes as variáveis de cálculo são resolvidas (permite uma usar a outra). */
    private const VARIABLE_PASSES = 3;

    /**
     * @param  array<string, mixed>  $stats
     */
    public function evaluate(?string $formula, array $stats = []): int
    {
        if ($formula === null || trim($formula) === '') {
            return 0;
        }

        try {
            return self::toInteger(floor($this->calculate(self::zeroUnknown($this->substitute($formula, $stats)))));
        } catch (InvalidFormulaException) {
            return 0;
        }
    }

    /**
     * Calcula uma expressão só com números e operadores.
     *
     * @throws InvalidFormulaException
     */
    public function calculate(string $expression): float
    {
        return ExpressionParser::calculate($expression);
    }

    /**
     * Troca as variáveis conhecidas pelos seus valores. As desconhecidas
     * permanecem no texto.
     *
     * @param  array<string, mixed>  $stats
     */
    public function substitute(string $formula, array $stats): string
    {
        $values = [];

        foreach ($stats as $name => $value) {
            $values[self::variableName((string) $name)] = $value;
        }

        return (string) preg_replace_callback(
            self::IDENTIFIER,
            static fn (array $match): string => array_key_exists($match[0], $values)
                ? self::formatNumber($values[$match[0]])
                : $match[0],
            self::normalize($formula),
        );
    }

    /**
     * Acrescenta as variáveis de cálculo das regras (calculation_vars),
     * que podem depender dos atributos e umas das outras.
     *
     * @param  array<string, mixed>  $stats
     * @param  array<string, mixed>|null  $variables
     * @return array<string, int|float>
     */
    public function resolveVariables(array $stats, ?array $variables): array
    {
        $resolved = [];

        foreach ($stats as $name => $value) {
            $resolved[self::variableName((string) $name)] = is_numeric($value) ? $value + 0 : 0;
        }

        for ($pass = 0; $pass < self::VARIABLE_PASSES; $pass++) {
            foreach ($variables ?? [] as $name => $formula) {
                $resolved[self::variableName((string) $name)] = $this->evaluate(is_scalar($formula) ? (string) $formula : null, $resolved);
            }
        }

        return $resolved;
    }

    /**
     * Forma canônica de um nome de variável: sem acentos e em maiúsculas.
     */
    public static function variableName(string $name): string
    {
        return strtoupper(Str::ascii(trim($name)));
    }

    /**
     * Variáveis que não existem valem 0, como no sistema antigo.
     */
    public static function zeroUnknown(string $expression): string
    {
        return (string) preg_replace(self::IDENTIFIER, '0', $expression);
    }

    public static function toInteger(float $value): int
    {
        if ($value > PHP_INT_MAX || $value < PHP_INT_MIN) {
            throw new InvalidFormulaException('Resultado fora dos limites.');
        }

        return (int) $value;
    }

    private static function normalize(string $formula): string
    {
        return strtoupper(Str::ascii($formula));
    }

    /**
     * Número pronto para entrar na expressão; negativos entre parênteses
     * para que "10 - FOR" com FOR = -2 continue válido.
     */
    private static function formatNumber(mixed $value): string
    {
        if (! is_numeric($value)) {
            return '0';
        }

        $number = $value + 0;
        $text = is_int($number) ? (string) $number : rtrim(rtrim(sprintf('%.10F', $number), '0'), '.');

        return $number < 0 ? '('.$text.')' : $text;
    }
}
