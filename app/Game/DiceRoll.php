<?php

declare(strict_types=1);

namespace App\Game;

use App\Enums\AdvantageMode;
use App\Enums\RollOutcome;

/**
 * Resultado do rolador de dados (quantidade, tipo de dado, modificador,
 * vantagem/desvantagem e meta opcional).
 */
final readonly class DiceRoll
{
    /**
     * @param  list<int>  $rolls  dados considerados
     * @param  list<int>  $discardedRolls  dado descartado pela vantagem/desvantagem
     * @param  string  $formula  ex.: "1d20 (Vantagem) + 2 vs ≤12"
     * @param  string  $details  ex.: "[4] (desc. 15) + 2"
     */
    public function __construct(
        public int $sides,
        public int $quantity,
        public int $modifier,
        public AdvantageMode $advantageMode,
        public ?int $target,
        public bool $rollUnder,
        public array $rolls,
        public array $discardedRolls,
        public int $total,
        public bool $isNat20,
        public bool $isNat1,
        public RollOutcome $outcome,
        public string $outcomeLabel,
        public string $formula,
        public string $details,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'sides' => $this->sides,
            'quantity' => $this->quantity,
            'modifier' => $this->modifier,
            'advantage_mode' => $this->advantageMode->value,
            'target' => $this->target,
            'roll_under' => $this->rollUnder,
            'rolls' => $this->rolls,
            'discarded_rolls' => $this->discardedRolls,
            'total' => $this->total,
            'is_nat20' => $this->isNat20,
            'is_nat1' => $this->isNat1,
            'outcome' => $this->outcome->value,
            'outcome_label' => $this->outcomeLabel,
            'formula' => $this->formula,
            'details' => $this->details,
        ];
    }
}
