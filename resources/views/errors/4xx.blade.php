{{-- Qualquer outro erro 4xx sem página própria. --}}
<x-error-page :exception="$exception ?? null" />
