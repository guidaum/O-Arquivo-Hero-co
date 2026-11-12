@props(['exception' => null, 'code' => null])

{{--
    Página de erro (resources/views/errors). Usa o layout de visitante, que
    não depende do banco nem do usuário logado: funciona até num erro 500 ou
    numa rota inexistente (sem sessão iniciada). Textos em App\Support\HttpErrors.
--}}
@php
    $status = (int) ($code ?? ($exception ? \App\Support\HttpErrors::status($exception) : 500));
    $page = \App\Support\HttpErrors::page($status);
    $message = \App\Support\HttpErrors::message($status, $exception);
    $previous = url()->previous();
    $canGoBack = $previous !== '' && $previous !== url()->current() && $status !== 401;
    $signedIn = auth()->check();
@endphp

<x-layouts.guest :title="$page['title']">
    <div class="error-page">
        <span class="icon-tile icon-tile--large error-page__icon" aria-hidden="true"><x-icon :name="$page['icon']" :size="28" /></span>
        <p class="error-page__code">Erro {{ $status }}</p>
        <p class="error-page__message">{{ $message }}</p>

        <div class="error-page__actions">
            @if ($status === 401 || ($status === 419 && ! $signedIn))
                <a class="button" href="{{ route('login') }}">Entrar</a>
            @else
                <a class="button" href="{{ route('dashboard') }}">
                    <x-icon name="layout-dashboard" :size="18" />
                    Ir para o início
                </a>
            @endif

            @if ($canGoBack)
                <a class="button button--secondary" href="{{ $previous }}">
                    <x-icon name="arrow-left" :size="18" />
                    Voltar
                </a>
            @endif
        </div>
    </div>
</x-layouts.guest>
