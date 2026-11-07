{{--
    A Mesa: convite, jogadores e personagens da campanha com vida
    (HealthTrackerWidget), progressão, NPCs/monstros e envio para a masmorra.
--}}
@php
    $filterUrl = static fn (array $query): string => route('gm.sessions.show', array_filter([
        $session->id,
        'aba' => 'mesa',
        'tipo' => $filter !== 'todos' ? $filter : null,
        'ordem' => $order !== 'nome' ? $order : null,
        ...$query,
    ], static fn ($value): bool => $value !== null && $value !== 'todos' && $value !== 'nome'));
@endphp

<div class="gm-session">
    <aside class="gm-session__side">
        <section class="gm-session__invite glass">
            <p class="eyebrow">Código de convite</p>
            <div class="gm-session__code">
                <code>{{ $session->code }}</code>
                <button type="button" class="icon-button icon-button--bordered" data-copy="{{ $session->code }}" title="Copiar código">
                    <x-icon name="copy" :size="16" />
                    <span class="visually-hidden">Copiar código</span>
                </button>
            </div>
            <p class="muted">Os jogadores usam este código em "Entrar" no painel inicial.</p>

            <dl class="gm-session__stats">
                <div><dt>Jogadores</dt><dd>{{ $session->players_count }}</dd></div>
                <div><dt>Personagens</dt><dd>{{ $session->characters_count }}</dd></div>
                <div><dt>Registros</dt><dd>{{ $session->journal_entries_count }}</dd></div>
            </dl>

            @if ($session->description)
                <p class="gm-session__description">{{ $session->description }}</p>
            @endif
        </section>

        <section class="gm-session__forge glass">
            <span class="icon-tile icon-tile--ember"><x-icon name="sparkles" :size="20" /></span>
            <div>
                <h2>Forja de NPCs</h2>
                <p class="muted">Gere aliados, vilões e monstros com atributos, perícias e poderes pelas regras da campanha.</p>
            </div>
            <button type="button" class="button button--ember button--block" data-modal-open="generate-npc">
                <x-icon name="plus" :size="16" /> Gerar NPC ou Monstro
            </button>
        </section>

        <section class="gm-session__progression glass">
            <p class="eyebrow">Ganhos por nível</p>
            <ul>
                <li><strong>{{ $progression['attr_points_per_level'] }}</strong> pontos de atributo</li>
                <li><strong>{{ $progression['skill_points_per_level'] }}</strong> pontos de perícia</li>
                <li><strong>{{ $progression['power_points_per_level'] }}</strong> pontos de poder</li>
            </ul>
            <a class="link-arrow" href="{{ route('gm.sessions.rules.edit', $session) }}">Ajustar nas regras <x-icon name="arrow-right" :size="14" /></a>
        </section>
    </aside>

    <div class="gm-session__main">
        @if ($errors->any() && ! $errors->generateNpc->any())
            <div class="alert alert--error" role="alert">{{ $errors->first() }}</div>
        @endif

        <div class="toolbar">
            <nav class="tabs tabs--small" aria-label="Tipo de personagem">
                @foreach (App\Http\Controllers\GmSessionController::CHARACTER_FILTERS as $key => $label)
                    <a class="tabs__link" href="{{ $filterUrl(['tipo' => $key]) }}" @if ($filter === $key) aria-current="page" @endif>{{ $label }}</a>
                @endforeach
            </nav>
            <nav class="tabs tabs--small" aria-label="Ordenação">
                <a class="tabs__link" href="{{ $filterUrl(['ordem' => 'nome']) }}" @if ($order === 'nome') aria-current="page" @endif>Nome</a>
                <a class="tabs__link" href="{{ $filterUrl(['ordem' => 'nivel']) }}" @if ($order === 'nivel') aria-current="page" @endif>Nível</a>
            </nav>
        </div>

        @if ($characters->isEmpty())
            <x-empty-state>
                @if ($filter === 'todos')
                    Nenhum personagem nesta campanha ainda. Compartilhe o código de convite ou gere um NPC.
                @else
                    Nenhum personagem com este filtro.
                @endif
            </x-empty-state>
        @else
            <div class="gm-roster">
                @foreach ($characters as $character)
                    @include('gm.sessions.partials.character-card', ['character' => $character])
                @endforeach
            </div>
        @endif
    </div>
</div>

@include('gm.sessions.partials.npc-modal')

<x-modal id="confirm-delete" title="Excluir NPC" danger>
    <div class="confirm-box">
        <div class="confirm-box__row">
            <span class="eyebrow">NPC</span>
            <strong data-modal-text="name"></strong>
        </div>
        <p>O NPC, os itens e as anotações dele serão apagados permanentemente. Os tokens dele nas masmorras também saem do mapa.</p>
    </div>

    <form class="modal__actions" method="POST" action="#" data-modal-form>
        @csrf
        @method('DELETE')
        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
        <button type="submit" class="button button--danger"><x-icon name="trash" :size="16" /> Sim, excluir</button>
    </form>
</x-modal>
