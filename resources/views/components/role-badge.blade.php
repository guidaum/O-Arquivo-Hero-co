@props(['role', 'pill' => false])

{{-- Selo do papel do usuário. $role é App\Enums\UserRole. --}}
<span {{ $attributes->class([
    'badge',
    'badge--pill' => $pill,
    'badge--admin' => $role === \App\Enums\UserRole::Admin,
    'badge--gm' => $role === \App\Enums\UserRole::Gm,
    'badge--player' => $role === \App\Enums\UserRole::User,
]) }}>{{ $role === \App\Enums\UserRole::Gm ? 'Mestre' : ($role === \App\Enums\UserRole::User ? 'Jogador' : 'Admin') }}</span>
