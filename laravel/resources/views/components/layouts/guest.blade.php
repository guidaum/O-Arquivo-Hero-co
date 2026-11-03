@props(['title', 'wide' => false])

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ $title }} · {{ config('app.name') }}</title>

        <script src="{{ asset('js/core/theme-init.js') }}"></script>
        <link rel="stylesheet" href="{{ asset('css/app.css') }}">
        <link rel="stylesheet" href="{{ asset('css/auth.css') }}">
    </head>
    <body>
        <main class="auth">
            <div @class(['auth__panel', 'auth__panel--wide' => $wide])>
                <header class="auth__brand">
                    <p class="auth__title">{{ config('app.name') }}</p>
                    <p class="auth__subtitle">{{ $title }}</p>
                </header>

                <section class="card">
                    <x-alert />

                    {{ $slot }}
                </section>

                @unless (request()->routeIs('privacy'))
                    <p class="auth__footer">
                        <a href="{{ route('privacy') }}">Política de Privacidade</a>
                    </p>
                @endunless
            </div>
        </main>

        <script type="module" src="{{ asset('js/core/theme.js') }}"></script>
    </body>
</html>
