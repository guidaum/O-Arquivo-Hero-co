<?php

declare(strict_types=1);

namespace App\Game;

use App\Enums\TraitType;
use App\Models\CharacterTrait;
use App\Models\Talent;
use Illuminate\Support\Str;

/**
 * Regras das vantagens e desvantagens (traços): custo, modificador efetivo
 * e atributos/talentos afetados. Porte de src/lib/utils.ts do sistema antigo.
 *
 * Um traço pode ser o model CharacterTrait ou um array com as chaves type,
 * name, description, effect, modifier e target (ID do atributo ou talento).
 *
 * Diferença intencional: talentos são reconhecidos no texto do efeito
 * apenas pelo nome. No Firebase os IDs eram aleatórios; aqui são números,
 * que se confundiriam com os valores do efeito ("+3 em ...").
 */
final class TraitCalculator
{
    private const WORD_SEPARATORS = '/[\s,.;:+\-()\[\]{}\/*\\\\|]+/u';

    private const DISADVANTAGE_MARKERS = ['disadvantage', 'defeito', 'desvantagem'];

    /**
     * Texto sem acentos, sem espaços nas pontas e em minúsculas.
     */
    public static function normalize(?string $text): string
    {
        return mb_strtolower(trim(Str::ascii((string) $text)));
    }

    /**
     * Valores com sinal do efeito ("+2 FOR, -1 AGI" → [2, -1]), ignorando
     * dados (1d6) e durações/contagens (1 vez, 2 turnos, nível 1).
     *
     * @return list<int>
     */
    public function effectValues(mixed $effect): array
    {
        if ($effect === null || $effect === '' || is_bool($effect)) {
            return [];
        }

        if (is_int($effect) || is_float($effect)) {
            return is_nan((float) $effect) ? [] : [(int) $effect];
        }

        if (is_array($effect)) {
            if (array_is_list($effect)) {
                return array_merge([], ...array_map($this->effectValues(...), $effect));
            }

            foreach (['value', 'modifier'] as $key) {
                if (is_int($effect[$key] ?? null) || is_float($effect[$key] ?? null)) {
                    return [(int) $effect[$key]];
                }
            }

            return ! empty($effect['effect']) ? $this->effectValues($effect['effect']) : [];
        }

        if (! is_scalar($effect)) {
            return [];
        }

        $text = (string) $effect;
        $text = (string) preg_replace('/\b[0-9]*d[0-9]+\b/i', ' ', $text);
        $text = (string) preg_replace('/([0-9]+)\s*(?:vez|vezes|turno|turnos|dia|dias|hora|horas|rodada|rodadas|nível|nivel|lvl)\b/iu', ' ', $text);
        $text = (string) preg_replace('/\b(?:menos|reduz(?:e)?|penalidade(?: de)?|subtrai)\s*([0-9]+)/iu', '-$1', $text);
        $text = (string) preg_replace('/\b(?:mais|aumenta|bônus(?: de)?|adiciona)\s*([0-9]+)/iu', '+$1', $text);

        preg_match_all('/[+-]?\s*[0-9]+/', $text, $matches);

        return array_map(
            static fn (string $value): int => (int) preg_replace('/\s+/', '', $value),
            $matches[0],
        );
    }

    /**
     * Custo do traço na criação de personagem:
     * - vantagem: metade da soma dos efeitos arredondada para cima + modificador;
     * - desvantagem: metade da soma dos efeitos arredondada para baixo + modificador.
     * A soma dos efeitos considera os sinais, mas entra no custo em valor
     * absoluto, assim como o modificador.
     *
     * @param  CharacterTrait|array<string, mixed>  $trait
     */
    public function costDetails(CharacterTrait|array $trait): TraitCost
    {
        $data = $this->data($trait);
        $isAdvantage = ! $this->isDisadvantage($trait);
        $effectValues = $this->effectValues($data['effect'] ?: $data['effects']);
        $rawEffectSum = array_sum($effectValues);
        $positiveEffectSum = abs($rawEffectSum);
        $modifier = is_numeric($data['modifier']) ? (int) abs((float) $data['modifier']) : 0;
        $halfEffect = (int) ($isAdvantage ? ceil($positiveEffectSum / 2) : floor($positiveEffectSum / 2));

        return new TraitCost(
            isAdvantage: $isAdvantage,
            modifier: $modifier,
            effectValues: $effectValues,
            rawEffectSum: $rawEffectSum,
            positiveEffectSum: $positiveEffectSum,
            halfEffect: $halfEffect,
            total: $halfEffect + $modifier,
        );
    }

    /**
     * @param  CharacterTrait|array<string, mixed>  $trait
     */
    public function cost(CharacterTrait|array $trait): int
    {
        return $this->costDetails($trait)->total;
    }

    /**
     * Pontos que sobram para vantagens: custo das desvantagens menos o das vantagens.
     *
     * @param  iterable<CharacterTrait|array<string, mixed>>  $traits
     */
    public function balance(iterable $traits): int
    {
        $balance = 0;

        foreach ($traits as $trait) {
            $type = strtolower($this->data($trait)['type']);

            if (in_array($type, ['disadvantage', 'defeito', 'desvantagem'], true)) {
                $balance += $this->cost($trait);
            } elseif (in_array($type, ['advantage', 'vantagem'], true)) {
                $balance -= $this->cost($trait);
            }
        }

        return $balance;
    }

    /**
     * @param  CharacterTrait|array<string, mixed>  $trait
     */
    public function isDisadvantage(CharacterTrait|array $trait): bool
    {
        return Str::contains(strtolower($this->data($trait)['type']), self::DISADVANTAGE_MARKERS);
    }

    /**
     * Modificador aplicado aos alvos, com o sinal que foi cadastrado,
     * seja vantagem ou desvantagem. Sem modificador, usa o primeiro número
     * com sinal do efeito.
     *
     * Atenção: uma desvantagem cadastrada com modificador positivo soma ao
     * atributo. É o comportamento atual do sistema antigo e foi mantido
     * para não alterar as fichas existentes.
     *
     * @param  CharacterTrait|array<string, mixed>  $trait
     */
    public function effectiveModifier(CharacterTrait|array $trait): int
    {
        $data = $this->data($trait);

        if ($data['modifier'] !== null && $data['modifier'] !== '' && is_numeric($data['modifier'])) {
            return (int) $data['modifier'];
        }

        if (is_scalar($data['effect']) && preg_match('/[+-]?\s*[0-9]+/', (string) $data['effect'], $match) === 1) {
            return (int) preg_replace('/\s+/', '', $match[0]);
        }

        return 0;
    }

    /**
     * Atributos e talentos afetados: o alvo do modificador, os citados no
     * efeito e, se nenhum for encontrado, os citados no nome ou na descrição.
     *
     * @param  CharacterTrait|array<string, mixed>  $trait
     * @param  list<array{id: string, label?: string}>  $attributes
     * @param  iterable<Talent|array{id: int|string, name?: ?string}>  $talents
     */
    public function targets(CharacterTrait|array $trait, array $attributes = [], iterable $talents = []): TraitTargets
    {
        $data = $this->data($trait);
        $attributes = $this->attributeList($attributes);
        $lookup = $this->lookup($attributes, $this->talentList($talents));
        $attributeIds = [];
        $talentIds = [];

        $collect = function (string $text, bool $wholeText, bool $useTalentIds) use ($lookup, $attributes, &$attributeIds, &$talentIds): void {
            $normalized = self::normalize($text);

            if ($normalized === '') {
                return;
            }

            if ($wholeText) {
                if (isset($lookup['attributes'][$normalized])) {
                    $attributeIds[$lookup['attributes'][$normalized]] = true;
                }

                $talentMap = $useTalentIds ? $lookup['talents'] : $lookup['talentWords'];

                if (isset($talentMap[$normalized])) {
                    $talentIds[$talentMap[$normalized]] = true;
                }
            }

            if (str_contains($normalized, 'todos os atributos') || str_contains($normalized, 'todos atributos')) {
                foreach ($attributes as $attribute) {
                    $attributeIds[strtolower($attribute['id'])] = true;
                }
            }

            foreach (self::words($normalized) as $word) {
                if (isset($lookup['attributes'][$word])) {
                    $attributeIds[$lookup['attributes'][$word]] = true;
                }

                if (isset($lookup['talentWords'][$word])) {
                    $talentIds[$lookup['talentWords'][$word]] = true;
                }
            }
        };

        $collect($data['target'], wholeText: true, useTalentIds: true);

        if (is_scalar($data['effect'])) {
            $collect((string) $data['effect'], wholeText: false, useTalentIds: false);
        }

        if ($attributeIds === [] && $talentIds === []) {
            $collect($data['name'], wholeText: true, useTalentIds: false);
            $collect($data['description'], wholeText: true, useTalentIds: false);
        }

        return new TraitTargets(
            array_map('strval', array_keys($attributeIds)),
            array_map('strval', array_keys($talentIds)),
        );
    }

    /**
     * Indica se o alvo do modificador e o efeito se referem ao mesmo
     * atributo ou talento (nesse caso o efeito não deve ser somado de novo).
     *
     * @param  CharacterTrait|array<string, mixed>  $trait
     * @param  list<array{id: string, label?: string}>  $attributes
     * @param  iterable<Talent|array{id: int|string, name?: ?string}>  $talents
     */
    public function isModifierSameAsEffect(CharacterTrait|array $trait, array $attributes = [], iterable $talents = []): bool
    {
        $data = $this->data($trait);
        $target = self::normalize($data['target']);
        $effect = is_scalar($data['effect']) ? self::normalize((string) $data['effect']) : '';

        if ($target === '' || $effect === '') {
            return false;
        }

        if ($target === $effect) {
            return true;
        }

        $lookup = $this->lookup($this->attributeList($attributes), $this->talentList($talents));

        $find = static function (string $text, array $wholeMap, array $wordMap): array {
            $found = [];

            if (isset($wholeMap[$text])) {
                $found[$wholeMap[$text]] = true;
            }

            foreach (self::words($text) as $word) {
                if (isset($wordMap[$word])) {
                    $found[$wordMap[$word]] = true;
                }
            }

            return $found;
        };

        $sameAttribute = array_intersect_key(
            $find($target, $lookup['attributes'], $lookup['attributes']),
            $find($effect, $lookup['attributes'], $lookup['attributes']),
        );

        if ($sameAttribute !== []) {
            return true;
        }

        return array_intersect_key(
            $find($target, $lookup['talents'], $lookup['talentWords']),
            $find($effect, $lookup['talentWords'], $lookup['talentWords']),
        ) !== [];
    }

    /**
     * Nome legível do alvo do modificador ("for" → "Força").
     *
     * @param  list<array{id: string, label?: string}>  $attributes
     * @param  iterable<Talent|array{id: int|string, name?: ?string}>  $talents
     */
    public function targetDisplayName(?string $target, array $attributes = [], iterable $talents = []): string
    {
        if ($target === null || $target === '') {
            return 'Geral';
        }

        $normalized = self::normalize($target);
        $attributes = $this->attributeList($attributes);
        $talents = $this->talentList($talents);
        $attributeName = static fn (array $attribute): string => ($attribute['label'] ?? '') !== '' ? $attribute['label'] : strtoupper($attribute['id']);
        $talentName = static fn (array $talent): string => $talent['name'] !== '' ? $talent['name'] : $talent['id'];

        foreach ($attributes as $attribute) {
            if (self::normalize($attribute['id']) === $normalized || self::normalize($attribute['label'] ?? '') === $normalized) {
                return $attributeName($attribute);
            }
        }

        foreach ($talents as $talent) {
            if (self::normalize($talent['id']) === $normalized || self::normalize($talent['name']) === $normalized) {
                return $talentName($talent);
            }
        }

        foreach ($attributes as $attribute) {
            $id = self::normalize($attribute['id']);
            $label = self::normalize($attribute['label'] ?? '');

            if (($label !== '' && str_contains($normalized, $label)) || ($id !== '' && str_contains($normalized, $id))) {
                return $attributeName($attribute);
            }
        }

        foreach ($talents as $talent) {
            $name = self::normalize($talent['name']);

            if ($name !== '' && (str_contains($normalized, $name) || str_contains($name, $normalized))) {
                return $talentName($talent);
            }
        }

        return Str::ucfirst($target);
    }

    /**
     * Soma dos modificadores dos traços por atributo (chave em minúsculas).
     *
     * @param  iterable<CharacterTrait|array<string, mixed>>  $traits
     * @param  list<array{id: string, label?: string}>  $attributes
     * @param  iterable<Talent|array{id: int|string, name?: ?string}>  $talents
     * @return array<string, int>
     */
    public function attributeModifiers(iterable $traits, array $attributes = [], iterable $talents = []): array
    {
        $talents = $this->talentList($talents);
        $modifiers = [];

        foreach ($traits as $trait) {
            $modifier = $this->effectiveModifier($trait);

            foreach ($this->targets($trait, $attributes, $talents)->attributeIds as $attributeId) {
                $modifiers[$attributeId] = ($modifiers[$attributeId] ?? 0) + $modifier;
            }
        }

        return $modifiers;
    }

    /**
     * Soma dos modificadores dos traços que citam o talento diretamente.
     * Traços sobre os atributos da composição já entram pelo atributo.
     *
     * @param  iterable<CharacterTrait|array<string, mixed>>  $traits
     * @param  list<array{id: string, label?: string}>  $attributes
     * @param  iterable<Talent|array{id: int|string, name?: ?string}>  $talents
     * @return array<string, int> chave = ID do talento
     */
    public function talentModifiers(iterable $traits, array $attributes = [], iterable $talents = []): array
    {
        $talents = $this->talentList($talents);
        $modifiers = array_fill_keys(array_map(static fn (array $talent): string => strtolower($talent['id']), $talents), 0);

        foreach ($traits as $trait) {
            $modifier = $this->effectiveModifier($trait);

            foreach ($this->targets($trait, $attributes, $talents)->talentIds as $talentId) {
                if (array_key_exists($talentId, $modifiers)) {
                    $modifiers[$talentId] += $modifier;
                }
            }
        }

        return $modifiers;
    }

    /**
     * @param  CharacterTrait|array<string, mixed>  $trait
     * @return array{type: string, name: string, description: string, effect: mixed, effects: mixed, modifier: mixed, target: string}
     */
    private function data(CharacterTrait|array $trait): array
    {
        if ($trait instanceof CharacterTrait) {
            $type = $trait->type;

            return [
                'type' => $type instanceof TraitType ? $type->value : (string) $type,
                'name' => (string) $trait->name,
                'description' => (string) $trait->description,
                'effect' => $trait->effect,
                'effects' => null,
                'modifier' => $trait->getAttribute('modifier'),
                'target' => (string) ($trait->modifier_attribute ?? $trait->modifier_talent_id ?? ''),
            ];
        }

        $type = $trait['type'] ?? '';
        $target = $trait['target'] ?? $trait['modifier_attribute'] ?? $trait['modifier_talent_id'] ?? '';

        return [
            'type' => $type instanceof TraitType ? $type->value : (is_scalar($type) ? (string) $type : ''),
            'name' => is_scalar($trait['name'] ?? null) ? (string) $trait['name'] : '',
            'description' => is_scalar($trait['description'] ?? null) ? (string) $trait['description'] : '',
            'effect' => $trait['effect'] ?? null,
            'effects' => $trait['effects'] ?? null,
            'modifier' => $trait['modifier'] ?? null,
            'target' => is_scalar($target) ? (string) $target : '',
        ];
    }

    /**
     * @param  list<array{id: string, label?: string}>  $attributes
     * @return list<array{id: string, label?: string}>
     */
    private function attributeList(array $attributes): array
    {
        return $attributes !== [] ? $attributes : config('arquivo.rules.attributes');
    }

    /**
     * @param  iterable<Talent|array{id: int|string, name?: ?string}>  $talents
     * @return list<array{id: string, name: string}>
     */
    private function talentList(iterable $talents): array
    {
        $list = [];

        foreach ($talents as $talent) {
            $list[] = $talent instanceof Talent
                ? ['id' => (string) $talent->getKey(), 'name' => (string) $talent->name]
                : ['id' => (string) $talent['id'], 'name' => (string) ($talent['name'] ?? '')];
        }

        return $list;
    }

    /**
     * Tabelas de busca: atributos por ID/rótulo, talentos por ID/nome e
     * talentos reconhecíveis dentro de um texto (sem IDs numéricos).
     *
     * @param  list<array{id: string, label?: string}>  $attributes
     * @param  list<array{id: string, name: string}>  $talents
     * @return array{attributes: array<string, string>, talents: array<string, string>, talentWords: array<string, string>}
     */
    private function lookup(array $attributes, array $talents): array
    {
        $lookup = ['attributes' => [], 'talents' => [], 'talentWords' => []];

        foreach ($attributes as $attribute) {
            $id = strtolower($attribute['id']);
            $lookup['attributes'][self::normalize($attribute['id'])] = $id;

            if (($attribute['label'] ?? '') !== '') {
                $lookup['attributes'][self::normalize($attribute['label'])] = $id;
            }
        }

        foreach ($talents as $talent) {
            $id = strtolower($talent['id']);
            $lookup['talents'][self::normalize($talent['id'])] = $id;

            if (! ctype_digit($talent['id'])) {
                $lookup['talentWords'][self::normalize($talent['id'])] = $id;
            }

            if ($talent['name'] !== '') {
                $lookup['talents'][self::normalize($talent['name'])] = $id;
                $lookup['talentWords'][self::normalize($talent['name'])] = $id;
            }
        }

        return $lookup;
    }

    /**
     * @return list<string>
     */
    private static function words(string $normalized): array
    {
        $text = (string) preg_replace('/\be\b/u', ' ', $normalized);

        return preg_split(self::WORD_SEPARATORS, $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }
}
