@props(['title', 'full' => false])

{{--
    Layout das páginas autenticadas. $navigation (App\Support\Navigation) vem
    do view composer registrado no AppServiceProvider.
    Use full para telas que ocupam toda a área (mapas), sem margens nem rodapé.
--}}
@php
    $user = $navigation->user();
    $items = $navigation->items();
@endphp

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="icon-sprite" content="{{ asset('images/icons.svg') }}">

        <title>{{ $title }} · {{ config('app.name') }}</title>

        <script src="{{ asset('js/core/theme-init.js') }}"></script>
        <link rel="preload" href="{{ asset('fonts/manrope-latin.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ asset('fonts/newsreader-latin.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="stylesheet" href="{{ asset('css/app.css') }}">
        @stack('styles')
    </head>
    <body>
        <div class="shell">
            <header class="topbar glass">
                <div class="topbar__start">
                    <button type="button" class="icon-button" data-sidebar-toggle aria-controls="sidebar" aria-expanded="true" aria-label="Abrir ou recolher o menu">
                        <x-icon name="menu" />
                    </button>

                    <a class="brand" href="{{ route('dashboard') }}">
                        <span class="icon-tile"><x-icon name="scroll-text" :size="18" /></span>
                        <span class="brand__title text-glow-arcane">{{ config('app.name') }}</span>
                    </a>
                </div>

                <div class="topbar__end">
                    @if ($navigation->canBeGm())
                        <x-view-mode-toggle :mode="$navigation->viewMode()" />
                    @endif

                    <button type="button" class="icon-button icon-button--bordered" data-theme-toggle aria-label="Alternar tema">
                        <x-icon name="sun" class="theme-toggle__sun" />
                        <x-icon name="moon" class="theme-toggle__moon" />
                    </button>

                    {{-- Menções no chat (NotificationBell.tsx), consultadas por polling. --}}
                    <details class="dropdown notifications" data-dropdown data-notifications data-url="{{ route('notifications.index') }}" data-read-url="{{ route('notifications.read') }}">
                        <summary class="icon-button" aria-label="Notificações" aria-expanded="false" aria-haspopup="menu">
                            <x-icon name="bell" />
                            <span class="notifications__dot" data-notifications-dot hidden></span>
                        </summary>

                        <div class="dropdown__menu notifications__menu">
                            <div class="dropdown__header">
                                <p class="eyebrow">Notificações</p>
                            </div>
                            <div class="notifications__list" data-notifications-list>
                                <p class="notifications__empty">Silêncio absoluto...</p>
                            </div>
                        </div>
                    </details>

                    <details class="dropdown hide-mobile" data-dropdown>
                        <summary class="icon-button" aria-label="Preferências" aria-expanded="false" aria-haspopup="menu">
                            <x-icon name="settings" />
                        </summary>

                        <div class="dropdown__menu">
                            <div class="dropdown__header">
                                <p class="eyebrow">Preferências do Sistema</p>
                            </div>

                            <div class="dropdown__group">
                                <a class="dropdown__item" href="{{ route('profile.edit') }}">
                                    <x-icon name="user" :size="18" />
                                    <span><strong>Meu Perfil</strong><small>Dados, avatar e biografia</small></span>
                                </a>
                            </div>

                            <div class="dropdown__group">
                                <form method="POST" action="{{ route('logout') }}">
                                    @csrf
                                    <button type="submit" class="dropdown__item dropdown__item--danger">
                                        <x-icon name="log-out" :size="18" />
                                        <strong>Sair da Sessão</strong>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </details>

                    <a class="user-chip" href="{{ route('profile.edit') }}" title="Meu perfil">
                        <span class="user-chip__text hide-mobile">
                            <span class="user-chip__name">
                                {{ $user->name }}
                                <x-role-badge :role="$user->role" />
                            </span>
                            <span class="user-chip__level">Nível {{ $navigation->level() }}</span>
                        </span>
                        <x-avatar :user="$user" />
                    </a>
                </div>
            </header>

            <div class="shell__body">
                <div class="sidebar-backdrop" data-sidebar-close></div>

                <aside class="sidebar glass" id="sidebar">
                    <nav class="sidebar__nav" aria-label="Menu principal">
                        @foreach ($items as $item)
                            <a
                                class="sidebar__link"
                                href="{{ route($item['route']) }}"
                                title="{{ $item['label'] }}"
                                @if (request()->routeIs($item['active'])) aria-current="page" @endif
                            >
                                <x-icon :name="$item['icon']" />
                                <span class="sidebar__label">{{ $item['label'] }}</span>
                            </a>
                        @endforeach
                    </nav>
                </aside>

                <main @class(['main', 'main--full' => $full])>
                    <div class="main__inner">
                        <x-alert />

                        {{ $slot }}
                    </div>

                    @unless ($full)
                        <footer class="app-footer">
                            <a href="{{ route('privacy') }}">Política de Privacidade</a>
                        </footer>
                    @endunless
                </main>

                {{-- Navegação inferior no celular, com os 5 primeiros itens (oculta nas telas de mapa). --}}
                <nav class="bottom-nav glass" aria-label="Atalhos">
                    @foreach (array_slice($items, 0, 5) as $item)
                        <a
                            class="bottom-nav__link"
                            href="{{ route($item['route']) }}"
                            @if (request()->routeIs($item['active'])) aria-current="page" @endif
                        >
                            <x-icon :name="$item['icon']" />
                            <span class="bottom-nav__label">{{ strtok($item['label'], ' ') }}</span>
                        </a>
                    @endforeach
                </nav>
            </div>
        </div>

        <script type="module" src="{{ asset('js/core/theme.js') }}"></script>
        <script type="module" src="{{ asset('js/core/layout.js') }}"></script>
        <script type="module" src="{{ asset('js/notifications/bell.js') }}"></script>
        @stack('scripts')
    </body>
</html>
