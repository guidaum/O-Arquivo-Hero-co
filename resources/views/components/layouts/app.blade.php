@props(['title', 'full' => false])

{{--
    Layout das páginas autenticadas. $navigation (App\Support\Navigation) vem
    do view composer registrado no AppServiceProvider.
    Use full para telas que ocupam toda a área (mapas), sem margens nem rodapé.

    Navegação responsiva (public/js/core/layout.js):
    - computador (>= 1024px): menu lateral fixo, recolhível só com ícones;
    - tablet e celular: menu lateral vira gaveta (botão do cabeçalho ou "Mais")
      e a barra inferior mostra os atalhos do modo de visão; a gaveta também
      traz a conta (perfil, modo Mestre/Jogador, sair), que no celular não
      cabe no cabeçalho.
--}}
@php
    $user = $navigation->user();
    $isActive = static fn (array $item): bool => request()->routeIs(...$item['active']);
    $groups = $navigation->groups();
    $shortcuts = $navigation->shortcuts($isActive);
@endphp

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#161311">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="icon-sprite" content="@asset('images/icons.svg')">
        {{-- Polling leve do tempo real, sem banco (core/realtime.js, App\Support\Pulse). --}}
        <meta name="pulse-url" content="{{ route('pulse') }}">

        <title>{{ $title }} · {{ config('app.name') }}</title>

        {{-- Versiona também os imports relativos entre módulos (App\Support\Assets). --}}
        <script type="importmap">@json(['imports' => \App\Support\Assets::importMap()])</script>
        <script src="@asset('js/core/theme-init.js')"></script>
        <link rel="preload" href="{{ asset('fonts/manrope-latin.woff2') }}" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="{{ asset('fonts/newsreader-latin.woff2') }}" as="font" type="font/woff2" crossorigin>
        {{-- Estilos globais em ordem de cascata: tokens/base, estrutura, componentes, telas. --}}
        <link rel="stylesheet" href="@asset('css/app.css')">
        <link rel="stylesheet" href="@asset('css/layout.css')">
        <link rel="stylesheet" href="@asset('css/components.css')">
        <link rel="stylesheet" href="@asset('css/responsive.css')">
        @stack('styles')
    </head>
    <body @class(['has-full-main' => $full])>
        <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

        <div class="shell">
            <header class="topbar glass">
                <div class="topbar__start">
                    <button type="button" class="icon-button" data-sidebar-toggle aria-controls="sidebar" aria-expanded="true" aria-label="Abrir ou recolher o menu">
                        <x-icon name="menu" />
                    </button>

                    <a class="brand" href="{{ route('dashboard') }}" aria-label="{{ config('app.name') }}: página inicial">
                        <span class="icon-tile"><x-icon name="scroll-text" :size="18" /></span>
                        <span class="brand__title text-glow-arcane">{{ config('app.name') }}</span>
                    </a>
                </div>

                <div class="topbar__end">
                    @if ($navigation->canBeGm())
                        <x-view-mode-toggle :mode="$navigation->viewMode()" class="hide-mobile" />
                    @endif

                    <button type="button" class="icon-button icon-button--bordered" data-theme-toggle aria-label="Alternar tema" title="Alternar tema claro/escuro">
                        <x-icon name="sun" class="theme-toggle__sun" />
                        <x-icon name="moon" class="theme-toggle__moon" />
                    </button>

                    {{-- Menções no chat (NotificationBell.tsx), consultadas por polling. --}}
                    <details class="dropdown notifications" data-dropdown data-notifications data-url="{{ route('notifications.index') }}" data-read-url="{{ route('notifications.read') }}">
                        <summary class="icon-button" aria-label="Notificações" title="Notificações" aria-expanded="false" aria-haspopup="menu">
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

                    <details class="dropdown hide-touch-nav" data-dropdown>
                        <summary class="icon-button" aria-label="Preferências" title="Preferências" aria-expanded="false" aria-haspopup="menu">
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

                    <a class="user-chip" href="{{ route('profile.edit') }}" title="Meu perfil" @if (request()->routeIs('profile.*')) aria-current="page" @endif>
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
                        @foreach ($groups as $group)
                            <div class="sidebar__group" role="group" aria-labelledby="sidebar-group-{{ $loop->index }}">
                                <p class="sidebar__heading" id="sidebar-group-{{ $loop->index }}">{{ $group['label'] }}</p>

                                @foreach ($group['items'] as $item)
                                    <a
                                        class="sidebar__link"
                                        href="{{ route($item['route']) }}"
                                        title="{{ $item['label'] }}"
                                        @if ($isActive($item)) aria-current="page" @endif
                                    >
                                        <x-icon :name="$item['icon']" />
                                        <span class="sidebar__label">{{ $item['label'] }}</span>
                                    </a>
                                @endforeach
                            </div>
                        @endforeach
                    </nav>

                    {{-- Conta: só na gaveta (tablet e celular), onde o cabeçalho não tem espaço. --}}
                    <div class="sidebar__account">
                        <a class="sidebar__profile" href="{{ route('profile.edit') }}">
                            <x-avatar :user="$user" />
                            <span class="sidebar__profile-text">
                                <strong>{{ $user->name }}</strong>
                                <small>Nível {{ $navigation->level() }} · Ver meu perfil</small>
                            </span>
                            <x-role-badge :role="$user->role" />
                        </a>

                        @if ($navigation->canBeGm())
                            <x-view-mode-toggle :mode="$navigation->viewMode()" large class="sidebar__mode" />
                        @endif

                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="sidebar__link sidebar__link--danger">
                                <x-icon name="log-out" />
                                <span class="sidebar__label">Sair da Sessão</span>
                            </button>
                        </form>
                    </div>
                </aside>

                {{-- Estado do tempo real (public/js/core/connection.js): sessão expirada, acesso removido ou conexão instável. --}}
                <div class="connection-banner glass" data-connection-banner role="status" aria-live="polite" hidden>
                    <x-icon name="wifi-off" :size="18" class="connection-banner__icon" />
                    <p class="connection-banner__text" data-connection-text></p>
                    <button type="button" class="button button--small" data-connection-reload hidden>Recarregar</button>
                </div>

                {{-- Aviso flutuante das telas (public/js/core/toast.js). --}}
                <p class="toast" data-toast role="status" aria-live="polite" hidden></p>

                <main id="conteudo" tabindex="-1" @class(['main', 'main--full' => $full])>
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

                {{--
                    Barra inferior (tablet e celular): até 4 atalhos do modo de visão
                    (a tela atual sempre aparece) e "Mais", que abre o menu completo.
                    Fica oculta nas telas de mapa, que usam toda a altura.
                --}}
                <nav class="bottom-nav glass" aria-label="Atalhos">
                    @foreach ($shortcuts as $item)
                        <a
                            class="bottom-nav__link"
                            href="{{ route($item['route']) }}"
                            @if ($isActive($item)) aria-current="page" @endif
                        >
                            <x-icon :name="$item['icon']" />
                            <span class="bottom-nav__label">{{ $item['short'] }}</span>
                        </a>
                    @endforeach

                    <button type="button" class="bottom-nav__link" data-sidebar-toggle aria-controls="sidebar" aria-expanded="false">
                        <x-icon name="menu" />
                        <span class="bottom-nav__label">Mais</span>
                    </button>
                </nav>
            </div>
        </div>

        <script type="module" src="@asset('js/core/theme.js')"></script>
        <script type="module" src="@asset('js/core/layout.js')"></script>
        <script type="module" src="@asset('js/core/connection.js')"></script>
        <script type="module" src="@asset('js/core/lightbox.js')"></script>
        <script type="module" src="@asset('js/notifications/bell.js')"></script>
        @stack('scripts')
    </body>
</html>
