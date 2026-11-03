<?php

declare(strict_types=1);

namespace App\Game;

/**
 * Analisador descendente recursivo para expressões aritméticas que já
 * tiveram as variáveis substituídas por números. Substitui o eval() do
 * sistema antigo: aceita apenas números, parênteses e + - * / % ^ (ou **).
 *
 * Gramática:
 *   expressao := termo (('+' | '-') termo)*
 *   termo     := unario (('*' | '/' | '%') unario)*
 *   unario    := ('+' | '-') unario | potencia
 *   potencia  := primario (('^' | '**') unario)?
 *   primario  := numero | '(' expressao ')'
 */
final class ExpressionParser
{
    public const MAX_LENGTH = 500;

    private const MAX_DEPTH = 50;

    private const TOKEN = '/\G\s*(?:(\d+(?:\.\d+)?|\.\d+)|(\*\*|[-+*\/%^()]))/';

    /** @var list<array{0: 'number'|'operator', 1: string}> */
    private array $tokens = [];

    private int $position = 0;

    private int $depth = 0;

    private function __construct(private readonly string $expression)
    {
    }

    public static function calculate(string $expression): float
    {
        return (new self($expression))->parse();
    }

    private function parse(): float
    {
        if (strlen($this->expression) > self::MAX_LENGTH) {
            throw InvalidFormulaException::at($this->expression, 'fórmula longa demais');
        }

        $this->tokenize();

        if ($this->tokens === []) {
            throw InvalidFormulaException::at($this->expression, 'fórmula vazia');
        }

        $value = $this->expression();

        if ($this->position < count($this->tokens)) {
            throw InvalidFormulaException::at($this->expression, 'símbolo inesperado "'.$this->tokens[$this->position][1].'"');
        }

        if (! is_finite($value)) {
            throw InvalidFormulaException::at($this->expression, 'resultado fora dos limites');
        }

        return $value;
    }

    private function tokenize(): void
    {
        $offset = 0;
        $length = strlen(rtrim($this->expression));

        while ($offset < $length) {
            if (preg_match(self::TOKEN, $this->expression, $match, 0, $offset) !== 1) {
                throw InvalidFormulaException::at($this->expression, 'caractere não permitido na posição '.($offset + 1));
            }

            $this->tokens[] = isset($match[2]) ? ['operator', $match[2]] : ['number', $match[1]];
            $offset += strlen($match[0]);
        }
    }

    private function expression(): float
    {
        $value = $this->term();

        while (($operator = $this->accept('+', '-')) !== null) {
            $right = $this->term();
            $value = $operator === '+' ? $value + $right : $value - $right;
        }

        return $value;
    }

    private function term(): float
    {
        $value = $this->unary();

        while (($operator = $this->accept('*', '/', '%')) !== null) {
            $right = $this->unary();

            if ($operator !== '*' && $right == 0.0) {
                throw InvalidFormulaException::at($this->expression, 'divisão por zero');
            }

            $value = match ($operator) {
                '*' => $value * $right,
                '/' => $value / $right,
                '%' => fmod($value, $right),
            };
        }

        return $value;
    }

    private function unary(): float
    {
        $operator = $this->accept('+', '-');

        if ($operator === null) {
            return $this->power();
        }

        return $this->nested(fn (): float => $operator === '-' ? -$this->unary() : $this->unary());
    }

    private function power(): float
    {
        $base = $this->primary();

        if ($this->accept('^', '**') === null) {
            return $base;
        }

        $value = $base ** $this->nested(fn (): float => $this->unary());

        if (is_nan($value)) {
            throw InvalidFormulaException::at($this->expression, 'potência inválida');
        }

        return $value;
    }

    private function primary(): float
    {
        $token = $this->tokens[$this->position] ?? null;

        if ($token === null) {
            throw InvalidFormulaException::at($this->expression, 'fórmula incompleta');
        }

        if ($token[0] === 'number') {
            $this->position++;

            return (float) $token[1];
        }

        if ($token[1] === '(') {
            $this->position++;
            $value = $this->nested(fn (): float => $this->expression());

            if ($this->accept(')') === null) {
                throw InvalidFormulaException::at($this->expression, 'parêntese não fechado');
            }

            return $value;
        }

        throw InvalidFormulaException::at($this->expression, 'símbolo inesperado "'.$token[1].'"');
    }

    /**
     * Limita o aninhamento para que entradas maliciosas não esgotem a pilha.
     *
     * @param  \Closure(): float  $callback
     */
    private function nested(\Closure $callback): float
    {
        if (++$this->depth > self::MAX_DEPTH) {
            throw InvalidFormulaException::at($this->expression, 'aninhamento excessivo');
        }

        try {
            return $callback();
        } finally {
            $this->depth--;
        }
    }

    private function accept(string ...$operators): ?string
    {
        $token = $this->tokens[$this->position] ?? null;

        if ($token !== null && $token[0] === 'operator' && in_array($token[1], $operators, true)) {
            $this->position++;

            return $token[1];
        }

        return null;
    }
}
