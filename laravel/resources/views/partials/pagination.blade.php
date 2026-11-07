{{-- Paginação padrão do sistema (registrada no AppServiceProvider). --}}
@if ($paginator->hasPages())
    <nav class="pagination" aria-label="Paginação">
        @if ($paginator->onFirstPage())
            <span class="pagination__link" aria-disabled="true">Anterior</span>
        @else
            <a class="pagination__link" href="{{ $paginator->previousPageUrl() }}" rel="prev">Anterior</a>
        @endif

        @foreach ($elements as $element)
            @if (is_string($element))
                <span class="pagination__link" aria-disabled="true">{{ $element }}</span>
            @endif

            @if (is_array($element))
                @foreach ($element as $page => $url)
                    @if ($page == $paginator->currentPage())
                        <span class="pagination__link" aria-current="page">{{ $page }}</span>
                    @else
                        <a class="pagination__link" href="{{ $url }}">{{ $page }}</a>
                    @endif
                @endforeach
            @endif
        @endforeach

        @if ($paginator->hasMorePages())
            <a class="pagination__link" href="{{ $paginator->nextPageUrl() }}" rel="next">Próxima</a>
        @else
            <span class="pagination__link" aria-disabled="true">Próxima</span>
        @endif
    </nav>
@endif
