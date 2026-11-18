<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Referência visual do mestre (Escudo do Mestre). image_path guarda um
 * caminho no disco "public" (referencias/) ou um link externo.
 */
#[Fillable(['title', 'category', 'notes', 'pinned'])]
class GameSessionReference extends Model
{
    use HasPublicFiles;

    public const CATEGORIES = [
        'scene' => 'Cenário',
        'npc' => 'NPC',
        'creature' => 'Criatura',
        'item' => 'Item',
        'map' => 'Mapa',
        'other' => 'Outro',
    ];

    public const DIRECTORY = 'referencias';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'pinned' => 'boolean',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    public function hasLocalFile(): bool
    {
        return $this->image_path !== null && $this->image_path !== '' && ! str_starts_with($this->image_path, 'http');
    }

    /**
     * Apaga o arquivo enviado (links externos ficam como estão).
     */
    public function deleteFile(): void
    {
        if ($this->hasLocalFile()) {
            Storage::disk('public')->delete($this->image_path);
        }
    }

    /**
     * Formato entregue ao navegador (public/js/gm-screen/references.js).
     *
     * @return array<string, mixed>
     */
    public function toScreenArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'category' => array_key_exists((string) $this->category, self::CATEGORIES) ? $this->category : 'other',
            'notes' => (string) $this->notes,
            'pinned' => $this->pinned,
            'image_url' => $this->image_url,
        ];
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }
}
