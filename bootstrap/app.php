<?php

declare(strict_types=1);

use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\TrackLastActivity;
use App\Support\HttpErrors;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);

        $middleware->web(append: [
            TrackLastActivity::class,
        ]);

        $middleware->redirectGuestsTo(fn (): string => route('login'));
        $middleware->redirectUsersTo(fn (): string => route('dashboard'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Pedidos fetch recebem a mensagem em português (App\Support\HttpErrors),
        // nunca o padrão do framework em inglês nem nomes de classes internas.
        // As páginas HTML usam resources/views/errors/4xx e 5xx.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request): ?JsonResponse {
            if (! ($request->is('api/*') || $request->expectsJson()) || ($e->getStatusCode() >= 500 && config('app.debug'))) {
                return null;
            }

            return response()->json(
                ['message' => HttpErrors::message($e->getStatusCode(), $e)],
                $e->getStatusCode(),
                $e->getHeaders(),
            );
        });
    })->create();
