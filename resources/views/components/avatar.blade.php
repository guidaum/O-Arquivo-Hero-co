@props(['user', 'large' => false])

{{-- Foto do usuário ou, sem foto, a inicial do nome. --}}
<span {{ $attributes->class(['avatar', 'avatar--large' => $large]) }}>
    @if ($user->photo_url)
        <img src="{{ $user->photo_url }}" alt="" referrerpolicy="no-referrer">
    @else
        <span aria-hidden="true">{{ mb_strtoupper(mb_substr($user->name, 0, 1)) }}</span>
    @endif
</span>
