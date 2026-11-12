{{-- Qualquer outro erro 5xx sem página própria. --}}
<x-error-page :exception="$exception ?? null" />
