<?php

declare(strict_types=1);

namespace App\Game;

/**
 * Atributos e talentos afetados por um traço.
 */
final readonly class TraitTargets
{
    /**
     * @param  list<string>  $attributeIds  IDs de atributo em minúsculas (for, agi...)
     * @param  list<string>  $talentIds  IDs dos talentos
     */
    public function __construct(
        public array $attributeIds,
        public array $talentIds,
    ) {
    }
}
