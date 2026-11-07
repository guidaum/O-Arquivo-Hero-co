<x-layouts.app title="Painel Admin">
    @include('admin.partials.header')

    <div class="stat-cards">
        @foreach ([
            ['Total de Usuários', $stats['users'], 'users', ''],
            ['Personagens Criados', $stats['characters'], 'sword', 'stat-card--ember'],
            ['Campanhas', $stats['sessions'], 'scroll-text', 'stat-card--gold'],
            ['Ativos nas últimas 24h', $stats['activeToday'], 'activity', 'stat-card--success'],
        ] as [$label, $value, $icon, $tone])
            <div class="stat-card glass {{ $tone }}">
                <div class="stat-card__top">
                    <span class="stat-card__icon"><x-icon :name="$icon" :size="24" /></span>
                    <span class="stat-card__value">{{ number_format($value, 0, ',', '.') }}</span>
                </div>
                <p class="stat-card__label">{{ $label }}</p>
            </div>
        @endforeach
    </div>
</x-layouts.app>
