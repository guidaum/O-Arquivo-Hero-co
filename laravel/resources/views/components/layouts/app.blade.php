@props(['title'])

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ $title }} · {{ config('app.name') }}</title>

        <script src="{{ asset('js/core/theme-init.js') }}"></script>
        <link rel="stylesheet" href="{{ asset('css/app.css') }}">
        @stack('styles')
    </head>
    <body>
        <header class="app-header">
            <a class="app-header__brand" href="{{ route('dashboard') }}">{{ config('app.name') }}</a>

            <nav class="app-nav" aria-label="Menu principal">
                <a href="{{ route('dashboard') }}" @if (request()->routeIs('dashboard')) aria-current="page" @endif>Início</a>
                <a href="{{ route('profile.edit') }}" @if (request()->routeIs('profile.*')) aria-current="page" @endif>Perfil</a>

                <button type="button" class="button button--secondary" data-theme-toggle>Tema claro</button>

                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="button button--secondary">Sair</button>
                </form>
            </nav>
        </header>

        <main class="app-main">
            <x-alert />

            {{ $slot }}
        </main>

        <footer class="app-footer">
            <a href="{{ route('privacy') }}">Política de Privacidade</a>
        </footer>

        <script type="module" src="{{ asset('js/core/theme.js') }}"></script>
        @stack('scripts')
    </body>
</html>
