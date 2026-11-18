<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Geometria da grade tática (quadrados ou hexágonos), com coordenadas em %
 * da imagem. As células são sempre numeradas linha * colunas + coluna, então
 * a névoa guardada vale nos dois formatos. Espelho em public/js/core/maps.js.
 *
 * Hexágonos: pontas para cima, linhas ímpares deslocadas meia célula para a
 * direita, encaixados na imagem (largura 100 / (colunas + 0,5), passo vertical
 * 100 / (linhas + 1/3), altura do hexágono = 4/3 do passo).
 */
final class BoardGrid
{
    public const SQUARE = 'square';

    public const HEX = 'hex';

    /** Formatos da grade: chave => rótulo. */
    public const TYPES = [
        self::SQUARE => 'Quadrados',
        self::HEX => 'Hexágonos',
    ];

    public static function normalizeType(mixed $type): string
    {
        return is_string($type) && array_key_exists($type, self::TYPES) ? $type : self::SQUARE;
    }

    /** Índice da célula sob um ponto (em %). */
    public static function cellOf(float $x, float $y, int $cols, int $rows, string $type = self::SQUARE): int
    {
        [$col, $row] = self::colRowOf($x, $y, $cols, $rows, $type);

        return $row * $cols + $col;
    }

    /**
     * @return array{0: int, 1: int} coluna e linha
     */
    public static function colRowOf(float $x, float $y, int $cols, int $rows, string $type = self::SQUARE): array
    {
        $cols = max(1, $cols);
        $rows = max(1, $rows);

        if ($type !== self::HEX) {
            return [
                min($cols - 1, max(0, (int) floor($x / 100 * $cols))),
                min($rows - 1, max(0, (int) floor($y / 100 * $rows))),
            ];
        }

        // Centro mais próximo numa métrica em que o hexágono desenhado é a
        // célula de Voronoi (eixo vertical, em passos, pesa (√3/2)²).
        [$width, $step] = self::hexMetrics($cols, $rows);
        $u = $x / $width;
        $v = $y / $step;
        $base = (int) floor($v);
        $best = [0, 0];
        $bestDistance = INF;

        for ($row = $base - 1; $row <= $base + 1; $row++) {
            if ($row < 0 || $row >= $rows) {
                continue;
            }

            $offset = $row % 2 === 1 ? 0.5 : 0.0;
            $col = min($cols - 1, max(0, (int) round($u - 0.5 - $offset)));
            $distance = ($u - ($col + 0.5 + $offset)) ** 2 + 0.75 * ($v - ($row + 2 / 3)) ** 2;

            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $best = [$col, $row];
            }
        }

        return $best;
    }

    /**
     * Centro de uma célula (em %).
     *
     * @return array{0: float, 1: float}
     */
    public static function center(int $col, int $row, int $cols, int $rows, string $type = self::SQUARE): array
    {
        $cols = max(1, $cols);
        $rows = max(1, $rows);

        if ($type !== self::HEX) {
            return [($col + 0.5) * 100 / $cols, ($row + 0.5) * 100 / $rows];
        }

        [$width, $step] = self::hexMetrics($cols, $rows);

        return [($col + 0.5 + ($row % 2 === 1 ? 0.5 : 0.0)) * $width, ($row + 2 / 3) * $step];
    }

    /**
     * Encaixa um token na grade. Quadrados: centro da célula para tamanho
     * ímpar, cruzamento das linhas para tamanho par, sempre dentro do mapa.
     * Hexágonos: centro do hexágono mais próximo.
     *
     * @return array{0: float, 1: float}
     */
    public static function snap(float $x, float $y, int $cols, int $rows, float $size, string $type = self::SQUARE): array
    {
        if ($type === self::HEX) {
            [$col, $row] = self::colRowOf($x, $y, $cols, $rows, self::HEX);
            [$cx, $cy] = self::center($col, $row, $cols, $rows, self::HEX);

            return [round($cx, 3), round($cy, 3)];
        }

        return [self::snapAxis($x, $cols, $size), self::snapAxis($y, $rows, $size)];
    }

    /** Encaixe de um eixo da grade quadrada. */
    public static function snapAxis(float $value, int $cells, float $size): float
    {
        $cell = 100 / max(1, $cells);
        $size = max(1.0, $size);
        $snapped = ((int) $size) % 2 === 1
            ? (floor($value / $cell) + 0.5) * $cell
            : round($value / $cell) * $cell;
        $half = $size * $cell / 2;

        return round(min(100 - $half, max($half, $snapped)), 3);
    }

    /**
     * Células ao redor de outra: raio 1 = só ela; quadrados 2 = 3×3, 3 = 5×5;
     * hexágonos 2 = ela e os 6 vizinhos, 3 = dois anéis (19 células).
     *
     * @return list<int>
     */
    public static function cellsAround(int $col, int $row, int $radius, int $cols, int $rows, string $type = self::SQUARE): array
    {
        $reach = max(0, $radius - 1);
        $cells = [];
        $extra = $type === self::HEX ? 1 : 0;

        for ($r = $row - $reach; $r <= $row + $reach; $r++) {
            for ($c = $col - $reach - $extra; $c <= $col + $reach + $extra; $c++) {
                if ($c < 0 || $c >= $cols || $r < 0 || $r >= $rows) {
                    continue;
                }
                if ($type === self::HEX && self::hexDistance($col, $row, $c, $r) > $reach) {
                    continue;
                }

                $cells[] = $r * $cols + $c;
            }
        }

        return $cells;
    }

    /** Distância em hexágonos entre duas células (coordenadas cúbicas). */
    public static function hexDistance(int $colA, int $rowA, int $colB, int $rowB): int
    {
        $qA = $colA - intdiv($rowA - ($rowA & 1), 2);
        $qB = $colB - intdiv($rowB - ($rowB & 1), 2);
        $dq = $qA - $qB;
        $dr = $rowA - $rowB;

        return intdiv(abs($dq) + abs($dr) + abs($dq + $dr), 2);
    }

    /**
     * Largura do hexágono e passo vertical entre linhas, em %.
     *
     * @return array{0: float, 1: float}
     */
    private static function hexMetrics(int $cols, int $rows): array
    {
        return [100 / ($cols + 0.5), 100 / ($rows + 1 / 3)];
    }
}
