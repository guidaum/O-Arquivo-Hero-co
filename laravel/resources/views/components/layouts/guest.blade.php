@props(['title', 'wide' => false])

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ $title }} · {{ config('app.name') }}</title>

        <script src="{{ asset('js/core/theme-init.js') }}"></script>
        <link rel="preload" href="{{ asset('fonts/newsreader-latin.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="stylesheet" href="{{ asset('css/app.css') }}">
        <link rel="stylesheet" href="{{ asset('css/auth.css') }}">
    </head>
    <body>
        <main class="auth">
            <div class="auth__glow auth__glow--arcane" aria-hidden="true"></div>
            <div class="auth__glow auth__glow--ember" aria-hidden="true"></div>

            <div @class(['auth__panel', 'auth__panel--wide' => $wide])>
                <section class="auth__card glass">
                    <header class="auth__brand">
                        <div class="auth__marks" aria-hidden="true">
                            <span class="icon-tile icon-tile--large"><x-icon name="shield" :size="24" /></span>
                            <span class="icon-tile icon-tile--large icon-tile--ember"><x-icon name="sword" :size="24" /></span>
                        </div>

                        <p class="auth__title text-glow-arcane">{{ config('app.name') }}</p>
                        <h1 class="auth__subtitle">{{ $title }}</h1>
                    </header>

                    <x-alert />

                    {{ $slot }}

                    <p class="auth__signature">
                        <x-icon name="scroll-text" :size="14" />
                        Sistema de Arquivamento Místico
                    </p>
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
