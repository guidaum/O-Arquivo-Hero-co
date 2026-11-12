{{--
    Cabeçalho dos formulários de catálogo: abas do catálogo base ou, quando
    o formulário é da campanha ($form['session']), as abas da biblioteca da
    campanha no Painel do Mestre, com o aviso de que a base não muda.
    Parâmetros: title, type (trecho da URL do tipo) e form.
--}}
@if ($form['session'])
    @include('gm.sessions.library.header', ['session' => $form['session'], 'current' => $type])

    @if ($form['notice'])
        <p class="alert library-notice"><x-icon name="shield" :size="16" /> {{ $form['notice'] }}</p>
    @endif
@else
    @include('catalog.partials.header', ['title' => $title])
@endif
