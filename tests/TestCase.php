<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Pulso do tempo real (App\Support\Pulse) em memória: o padrão "file"
        // deixaria versões gravadas em storage/ entre uma execução e outra.
        config(['arquivo.realtime.store' => 'array']);
    }
}
