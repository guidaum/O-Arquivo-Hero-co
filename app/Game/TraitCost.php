<?php

declare(strict_types=1);

namespace App\Game;

/**
 * Detalhamento do custo de uma vantagem ou desvantagem.
 */
final readonly class TraitCost
{
    /**
     * @param  list<int>  $effectValues
     */
    public function __construct(
        public bool $isAdvantage,
        public int $modifier,
        public array $effectValues,
        public int $rawEffectSum,
        public int $positiveEffectSum,
        public int $halfEffect,
        public int $total,
    ) {
    }
}
