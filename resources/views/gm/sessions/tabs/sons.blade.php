{{--
    Sons da campanha (SoundEffectManager.tsx): o som de cada efeito (sintetizado,
    da biblioteca ou endereço externo) e a biblioteca de áudios do mestre.
    A trilha ambiente e os efeitos "para a mesa" ficam no menu de ações
    (Ambientação). Testes e prévias tocam no navegador (public/js/gm/sounds.js).
--}}
@php
    $bag = $errors->sounds;
    $libraryBag = $errors->library;
    $groups = collect(App\Support\Sounds::EFFECTS)->groupBy(static fn (array $effect): string => $effect[1], true);
@endphp

<div class="gm-sounds" data-sounds>
    <form method="POST" action="{{ route('gm.sessions.sounds.update', $session) }}" class="gm-sounds__slots form">
        @csrf
        @method('PUT')

        <x-section title="Efeitos sonoros" icon="volume">
            <x-slot:action>
                <button type="submit" class="button button--gold"><x-icon name="save" :size="16" /> Salvar sons</button>
            </x-slot:action>

            @if ($bag->any())
                <div class="alert alert--error" role="alert">{{ $bag->first() }}</div>
            @endif

            <p class="muted">
                "Sintetizado" gera o som no navegador, sem arquivos. Envie áudios para a biblioteca ao lado para usá-los aqui.
                @unless ($ownSoundRules)
                    A campanha ainda usa as regras globais: ao salvar, ela ganha regras próprias (cópia das globais).
                @endunless
            </p>

            @foreach ($groups as $category => $effects)
                <h3 class="gm-sounds__category">{{ App\Support\Sounds::CATEGORIES[$category] }}</h3>
                <div class="gm-sounds__list">
                    @foreach ($effects as $key => [$label, , $description])
                        @php
                            $current = old('sounds.'.$key, $storedSounds[$key] ?? null);
                            $isUrl = is_string($current) && preg_match('#^https?://#i', $current) === 1;
                            $selected = $isUrl ? 'url' : ($current ?? '');
                        @endphp
                        <div class="gm-sound" data-sound-slot="{{ $key }}">
                            <div class="gm-sound__info">
                                <strong>{{ $label }}</strong>
                                <small class="muted">{{ $description }}</small>
                            </div>
                            <div class="gm-sound__controls">
                                <label class="visually-hidden" for="sound-{{ $key }}">Som de {{ $label }}</label>
                                <select class="select" id="sound-{{ $key }}" name="sounds[{{ $key }}]" data-sound-choice>
                                    <option value="" @selected($selected === '' || str_starts_with((string) $selected, 'synth:'))>Sintetizado</option>
                                    @foreach ($library as $sound)
                                        <option value="sound:{{ $sound->id }}" data-url="{{ $sound->url }}" @selected($selected === 'sound:'.$sound->id)>{{ $sound->name }}</option>
                                    @endforeach
                                    <option value="url" @selected($selected === 'url')>Endereço externo...</option>
                                </select>
                                <label class="visually-hidden" for="sound-url-{{ $key }}">Endereço do som de {{ $label }}</label>
                                <input
                                    class="field__input"
                                    id="sound-url-{{ $key }}"
                                    type="url"
                                    name="sound_urls[{{ $key }}]"
                                    value="{{ old('sound_urls.'.$key, $isUrl ? $current : '') }}"
                                    maxlength="255"
                                    placeholder="https://..."
                                    data-sound-url
                                    @unless ($selected === 'url') hidden @endunless
                                >
                                <button type="button" class="icon-button icon-button--bordered" data-sound-test="{{ $key }}" title="Testar {{ $label }}">
                                    <x-icon name="volume" :size="16" />
                                    <span class="visually-hidden">Testar {{ $label }}</span>
                                </button>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endforeach

            <div class="form-actions">
                @can('access-admin')
                    <label class="checkbox">
                        <input type="hidden" name="also_global" value="0">
                        <input type="checkbox" name="also_global" value="1"> Também usar como padrão global (novas campanhas)
                    </label>
                @endcan
                <button type="submit" class="button button--gold"><x-icon name="save" :size="16" /> Salvar sons</button>
            </div>
        </x-section>
    </form>

    <aside class="gm-sounds__library">
        <x-section title="Biblioteca" icon="library">
            <form method="POST" action="{{ route('gm.sessions.sounds.store', $session) }}" enctype="multipart/form-data" class="form gm-sounds__upload">
                @csrf

                @if ($libraryBag->any())
                    <div class="alert alert--error" role="alert">{{ $libraryBag->first() }}</div>
                @endif

                <x-form.field name="name" label="Nome" bag="library" maxlength="255" required placeholder="Ex.: Porta da cripta" id="library-name" />
                <x-form.field name="category" label="Categoria" type="select" bag="library" :options="App\Support\Sounds::CATEGORIES" value="combat" id="library-category" />
                <x-form.field name="file" label="Arquivo de áudio" type="file" bag="library" accept=".mp3,.wav,.ogg,.oga,.m4a,.webm,audio/*" hint="MP3, WAV, OGG, M4A ou WEBM até 10 MB." id="library-file" />
                <x-form.field name="url" label="Ou endereço externo" type="url" bag="library" maxlength="2048" placeholder="https://..." id="library-url" />

                <fieldset class="radio-group">
                    <legend class="field__label">Disponível em</legend>
                    <label class="checkbox"><input type="radio" name="scope" value="campaign" @checked(old('scope', 'campaign') === 'campaign')> Só nesta campanha</label>
                    <label class="checkbox"><input type="radio" name="scope" value="personal" @checked(old('scope') === 'personal')> Todas as minhas campanhas</label>
                </fieldset>

                <button type="submit" class="button button--secondary"><x-icon name="plus" :size="16" /> Adicionar à biblioteca</button>
            </form>

            @if ($library->isEmpty())
                <x-empty-state>Nenhum áudio na biblioteca ainda.</x-empty-state>
            @else
                <ul class="gm-sounds__items">
                    @foreach ($library as $sound)
                        <li class="gm-sounds__item">
                            <button type="button" class="icon-button icon-button--bordered" data-sound-preview="{{ $sound->url }}" title="Ouvir {{ $sound->name }}">
                                <x-icon name="volume" :size="16" />
                                <span class="visually-hidden">Ouvir {{ $sound->name }}</span>
                            </button>
                            <div class="gm-sounds__item-main">
                                <strong>{{ $sound->name }}</strong>
                                <small class="muted">
                                    {{ App\Support\Sounds::CATEGORIES[$sound->category] ?? $sound->category }}
                                    · {{ $sound->game_session_id === null ? 'Pessoal' : 'Campanha' }}
                                    @if ($sound->format) · {{ $sound->format }} @endif
                                    @if ($sound->size) · {{ number_format($sound->size / 1024, 0, ',', '.') }} KB @endif
                                </small>
                            </div>
                            <button
                                type="button"
                                class="icon-button icon-button--danger"
                                title="Remover da biblioteca"
                                data-modal-open="confirm-sound-delete"
                                data-modal-action="{{ route('gm.sessions.sounds.destroy', [$session, $sound]) }}"
                                data-modal-text-name="{{ $sound->name }}"
                            >
                                <x-icon name="trash" :size="16" />
                                <span class="visually-hidden">Remover {{ $sound->name }}</span>
                            </button>
                        </li>
                    @endforeach
                </ul>
            @endif
        </x-section>
    </aside>
</div>

<x-modal id="confirm-sound-delete" title="Remover som" danger>
    <div class="confirm-box">
        <div class="confirm-box__row">
            <span class="eyebrow">Som</span>
            <strong data-modal-text="name"></strong>
        </div>
        <p>O arquivo é apagado. Os efeitos que usavam este som voltam ao som sintetizado.</p>
    </div>
    <form class="modal__actions" method="POST" action="#" data-modal-form>
        @csrf
        @method('DELETE')
        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
        <button type="submit" class="button button--danger"><x-icon name="trash" :size="16" /> Remover</button>
    </form>
</x-modal>
