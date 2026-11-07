<?php

declare(strict_types=1);

namespace App\Game;

use App\Enums\TestDifficulty;

/**
 * Resultado de um teste rápido de atributo, talento ou perícia
 * (menor é melhor: passa quem rolar até o valor-alvo).
 */
final readonly class AttributeTestRoll
{
    public function __construct(
        public int $value,
        public TestDifficulty $difficulty,
        public int $target,
        public int $sides,
        public int $roll,
        public bool $success,
        public bool $isCritical,
        public bool $isFumble,
    ) {
    }

    /**
     * Texto da rolagem para o chat, ex.: "1D20 <= 12".
     */
    public function detail(): string
    {
        return sprintf('1D%d <= %d', $this->sides, $this->target);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'value' => $this->value,
            'difficulty' => $this->difficulty->value,
            'difficulty_label' => $this->difficulty->label(),
            'target' => $this->target,
            'sides' => $this->sides,
            'roll' => $this->roll,
            'success' => $this->success,
            'is_critical' => $this->isCritical,
            'is_fumble' => $this->isFumble,
            'detail' => $this->detail(),
        ];
    }
}
