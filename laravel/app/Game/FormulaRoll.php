<?php

declare(strict_types=1);

namespace App\Game;

/**
 * Resultado de uma fórmula com dados ("2D6 + FOR").
 */
final readonly class FormulaRoll
{
    /**
     * @param  list<array{die: string, values: list<int>}>  $rolls  dados rolados
     * @param  string  $detail  fórmula com variáveis e dados já substituídos
     */
    public function __construct(
        public int $total,
        public array $rolls,
        public string $detail,
    ) {
    }

    /**
     * @return array{total: int, rolls: list<array{die: string, values: list<int>}>, detail: string}
     */
    public function toArray(): array
    {
        return [
            'total' => $this->total,
            'rolls' => $this->rolls,
            'detail' => $this->detail,
        ];
    }
}
