@php
    $firstName = strtok($user->name, ' ');
@endphp

<x-layouts.app :title="$gmView ? 'Painel do Mestre' : 'Minhas Lendas'">
    <x-page-header
        :title="($gmView ? 'Painel do Mestre' : 'Minhas Lendas').', '.$firstName"
        :subtitle="$gmView ? 'Gerencie suas campanhas, regras e fichas da mesa' : 'As crônicas e personagens da sua jornada'"
    >
        <x-slot:badges>
            <span @class(['badge', 'badge--pill', 'badge--gm' => $gmView, 'badge--player' => ! $gmView])>
                <x-icon :name="$gmView ? 'shield' : 'sword'" :size="12" />
                {{ $gmView ? 'Interface do Mestre' : 'Interface do Jogador' }}
            </span>
            @if ($user->isAdmin())
                <x-role-badge :role="$user->role" pill />
            @endif
        </x-slot:badges>

        <x-slot:actions>
            @can('use-feature', 'characterCreation')
                <a class="button button--parchment button--pill" href="{{ route('characters.create') }}">
                    <x-icon name="plus" />
                    Nova Lenda
                </a>
            @endcan
        </x-slot:actions>
    </x-page-header>

    {{-- Alternador rápido entre Mestre e Jogador, disponível para todos, como no sistema antigo. --}}
    <div class="centered">
        <x-view-mode-toggle :mode="$navigation->viewMode()" large />
    </div>

    @php
        $canCreateSession = $gmView && $user->can('create', App\Models\GameSession::class);
        $canCreateCharacter = $user->can('use-feature', 'characterCreation');
    @endphp

    {{-- Campanhas: a ação de entrar (ou mestrar) fica ao lado da lista, onde ela faz efeito. --}}
    <x-section :title="$gmView ? 'Minhas Campanhas Ativas' : 'Minhas Campanhas'" :icon="$gmView ? 'users' : 'history'">
        {{-- Lista vazia: as mesmas ações aparecem no próprio aviso, sem repetir aqui. --}}
        <x-slot:action>
            @if ($sessions->isNotEmpty())
                <div class="section__actions">
                    <button type="button" class="button button--secondary button--pill button--small" data-modal-open="join-session">
                        <x-icon name="key" :size="16" />
                        Entrar com código
                    </button>
                    @if ($canCreateSession)
                        <button type="button" class="button button--pill button--small" data-modal-open="create-session">
                            <x-icon name="crown" :size="16" />
                            Mestrar
                        </button>
                    @endif
                </div>
            @endif
        </x-slot:action>

        <div class="card-grid">
            @forelse ($sessions as $session)
                @if ($gmView)
                    <x-campaign-card :session="$session" :href="route('gm.sessions.show', $session)" />
                @else
                    @php
                        $ownCharacter = $characterBySession->get($session->id);
                        $sessionHref = match (true) {
                            $ownCharacter !== null && $user->can('use-feature', 'characterSheet') => route('characters.show', $ownCharacter),
                            $user->can('use-feature', 'journal') => route('journal.index', ['visao' => 'campanha', 'campanha' => $session->id]),
                            default => null,
                        };
                    @endphp
                    <x-campaign-card :session="$session" show-gm :href="$sessionHref" />
                @endif
            @empty
                @if ($gmView)
                    <x-empty-state icon="crown" hint="Crie uma campanha e compartilhe o código de 6 letras com os jogadores.">
                        Você ainda não criou nenhuma campanha.
                        <x-slot:action>
                            <div class="section__actions">
                                @if ($canCreateSession)
                                    <button type="button" class="button button--pill" data-modal-open="create-session">
                                        <x-icon name="crown" :size="16" />
                                        Mestrar uma campanha
                                    </button>
                                @endif
                                <button type="button" class="button button--secondary button--pill" data-modal-open="join-session">
                                    <x-icon name="key" :size="16" />
                                    Entrar com código
                                </button>
                            </div>
                        </x-slot:action>
                    </x-empty-state>
                @else
                    <x-empty-state icon="key" hint="Peça ao mestre o código de 6 letras da campanha para entrar na jornada.">
                        Você ainda não participa de nenhuma campanha.
                        <x-slot:action>
                            <button type="button" class="button button--secondary button--pill" data-modal-open="join-session">
                                <x-icon name="key" :size="16" />
                                Entrar com código
                            </button>
                        </x-slot:action>
                    </x-empty-state>
                @endif
            @endforelse
        </div>
    </x-section>

    <x-section :title="$gmView ? 'Minhas Lendas (DMPCs/NPCs)' : 'Lendas Ativas'" :icon="$gmView ? 'sword' : 'users'" :tone="$gmView ? 'ember' : 'arcane'">
        <div class="card-grid">
            @forelse ($characters as $character)
                <x-character-card :character="$character" :stat-attributes="$cardAttributes" :deletable="$user->can('delete', $character)" />
            @empty
                <x-empty-state icon="sparkles" hint="Escolha traços, distribua atributos e compre perícias e poderes em poucos passos.">
                    Nenhum personagem criado ainda.
                    @if ($canCreateCharacter)
                        <x-slot:action>
                            <a class="button button--parchment button--pill" href="{{ route('characters.create') }}">
                                <x-icon name="plus" :size="16" />
                                Forjar minha primeira lenda
                            </a>
                        </x-slot:action>
                    @endif
                </x-empty-state>
            @endforelse

            @if ($characters->isNotEmpty() && $canCreateCharacter)
                {{-- Atalho no fim da lista: criar outro personagem sem voltar ao topo. --}}
                <a class="character-card-new" href="{{ route('characters.create') }}">
                    <span class="character-card-new__icon"><x-icon name="plus" :size="28" /></span>
                    <span class="character-card-new__title">Nova Lenda</span>
                    <span class="character-card-new__hint">Forjar outro personagem</span>
                </a>
            @endif
        </div>
    </x-section>

    {{-- Exclusão de personagem pelo dono: a lixeira de cada cartão preenche este formulário. --}}
    <x-modal id="delete-character" title="Excluir Personagem?" danger>
        <div class="confirm-box">
            <p>
                Tem certeza que deseja excluir <strong>"<span data-modal-text="name"></span>"</strong>?
                Perícias, poderes, traços, itens, anotações e tokens nas masmorras também serão apagados.
                Esta ação não pode ser desfeita.
            </p>
        </div>

        <form class="modal__actions" method="POST" action="#" data-modal-form>
            @csrf
            @method('DELETE')

            <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
            <button type="submit" class="button button--danger">
                <x-icon name="trash" :size="16" />
                Sim, Excluir
            </button>
        </form>
    </x-modal>

    {{-- Entrar numa campanha pelo código que o mestre compartilhou. --}}
    <x-modal id="join-session" title="Entrar em Campanha" :open-on-load="$errors->joinSession->isNotEmpty()">
        <form method="POST" action="{{ route('sessions.join') }}" class="form">
            @csrf
            <x-form.field name="code" label="Código da sessão" bag="joinSession" required maxlength="32" placeholder="Ex.: ABC123" autocomplete="off" class="input--code" />
            <div class="modal__actions">
                <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                <button type="submit" class="button button--ember">Entrar na Jornada</button>
            </div>
        </form>
    </x-modal>

    @if ($gmView)
        @can('create', App\Models\GameSession::class)
            <x-modal id="create-session" title="Nova Campanha" :open-on-load="$errors->createSession->isNotEmpty()">
                <form method="POST" action="{{ route('sessions.store') }}" class="form">
                    @csrf
                    <x-form.field name="name" label="Nome da campanha" bag="createSession" required maxlength="255" placeholder="Ex.: As Crônicas de Eldoria" />
                    <x-form.field name="description" label="Descrição" type="textarea" bag="createSession" rows="3" maxlength="5000" />
                    <p class="field__hint">As regras começam iguais às Configurações Base; ajuste depois em "Regras da Campanha".</p>
                    <div class="modal__actions">
                        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                        <button type="submit" class="button">Criar Campanha</button>
                    </div>
                </form>
            </x-modal>
        @endcan
    @endif
</x-layouts.app>
