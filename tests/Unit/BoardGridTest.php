<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\BoardGrid;
use PHPUnit\Framework\TestCase;

/**
 * Geometria da grade tática (App\Support\BoardGrid), espelhada em
 * public/js/core/maps.js. Grade de teste: 24 × 14 células.
 */
class BoardGridTest extends TestCase
{
    public function test_square_cells_and_snap_keep_the_previous_behavior(): void
    {
        $this->assertSame(26, BoardGrid::cellOf(10, 10, 24, 14));
        $this->assertSame([90.0, 40.0], BoardGrid::snap(99, 41, 10, 10, 2));
        $this->assertSame([45.0, 15.0], BoardGrid::snap(41, 12, 10, 10, 1));
        $this->assertCount(25, BoardGrid::cellsAround(5, 5, 3, 24, 14));
    }

    public function test_every_hex_center_belongs_to_its_own_cell(): void
    {
        for ($row = 0; $row < 14; $row++) {
            for ($col = 0; $col < 24; $col++) {
                [$x, $y] = BoardGrid::center($col, $row, 24, 14, BoardGrid::HEX);
                $this->assertSame([$col, $row], BoardGrid::colRowOf($x, $y, 24, 14, BoardGrid::HEX));
            }
        }
    }

    public function test_hex_rows_are_offset_and_fit_inside_the_image(): void
    {
        [$evenX] = BoardGrid::center(0, 0, 24, 14, BoardGrid::HEX);
        [$oddX] = BoardGrid::center(0, 1, 24, 14, BoardGrid::HEX);
        [$lastX, $lastY] = BoardGrid::center(23, 13, 24, 14, BoardGrid::HEX);
        $width = 100 / 24.5;

        $this->assertEqualsWithDelta($width / 2, $evenX, 0.0001);
        $this->assertEqualsWithDelta($width, $oddX, 0.0001);
        $this->assertEqualsWithDelta(100 - $width / 2, $lastX, 0.0001);
        $this->assertLessThan(100, $lastY);
    }

    public function test_hex_snap_goes_to_the_nearest_center(): void
    {
        $this->assertSame([8.163, 11.628], BoardGrid::snap(10, 10, 24, 14, 1, BoardGrid::HEX));
        $this->assertSame([51.02, 46.512], BoardGrid::snap(50.3, 47.1, 24, 14, 2, BoardGrid::HEX));
    }

    public function test_hex_neighbors_and_distance(): void
    {
        // Linha ímpar (deslocada): vizinhos em cima e embaixo são as colunas 5 e 6.
        $this->assertSame([101, 102, 124, 125, 126, 149, 150], BoardGrid::cellsAround(5, 5, 2, 24, 14, BoardGrid::HEX));
        $this->assertCount(19, BoardGrid::cellsAround(5, 5, 3, 24, 14, BoardGrid::HEX));
        $this->assertCount(19, BoardGrid::cellsAround(5, 6, 3, 24, 14, BoardGrid::HEX));
        $this->assertSame([0, 1, 24], BoardGrid::cellsAround(0, 0, 2, 24, 14, BoardGrid::HEX));
        $this->assertSame(5, BoardGrid::hexDistance(0, 0, 3, 3));
        $this->assertSame(1, BoardGrid::hexDistance(5, 5, 6, 4));
        $this->assertSame(2, BoardGrid::hexDistance(5, 4, 5, 6));
    }

    public function test_unknown_types_fall_back_to_squares(): void
    {
        $this->assertSame(BoardGrid::SQUARE, BoardGrid::normalizeType('triangulos'));
        $this->assertSame(BoardGrid::HEX, BoardGrid::normalizeType('hex'));
        $this->assertSame(BoardGrid::SQUARE, BoardGrid::normalizeType(null));
    }
}
