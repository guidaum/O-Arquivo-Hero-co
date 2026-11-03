<x-layouts.app title="Início">
    <h1>Olá, {{ $user->name }}!</h1>
    <p class="muted">Papel: {{ $user->role->label() }}</p>

    <div class="grid">
        @can('use-gm-tools')
            <section class="card">
                <h2 class="card__title">Campanhas que você mestra</h2>
                @forelse ($gmSessions as $session)
                    @if ($loop->first) <ul class="list"> @endif
                        <li>{{ $session->name }} <span class="muted">· código {{ $session->code }}</span></li>
                    @if ($loop->last) </ul> @endif
                @empty
                    <p class="card__text">Nenhuma campanha ainda.</p>
                @endforelse
            </section>
        @endcan

        <section class="card">
            <h2 class="card__title">Campanhas em que você joga</h2>
            @forelse ($playerSessions as $session)
                @if ($loop->first) <ul class="list"> @endif
                    <li>{{ $session->name }}</li>
                @if ($loop->last) </ul> @endif
            @empty
                <p class="card__text">Você ainda não participa de nenhuma campanha.</p>
            @endforelse
        </section>

        <section class="card">
            <h2 class="card__title">Seus personagens</h2>
            @forelse ($characters as $character)
                @if ($loop->first) <ul class="list"> @endif
                    <li>
                        {{ $character->name }}
                        <span class="muted">· nível {{ $character->level }}@if ($character->gameSession) · {{ $character->gameSession->name }}@endif</span>
                    </li>
                @if ($loop->last) </ul> @endif
            @empty
                <p class="card__text">Nenhum personagem criado.</p>
            @endforelse
        </section>
    </div>
</x-layouts.app>
