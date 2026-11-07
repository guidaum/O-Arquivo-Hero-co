<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasPublicFiles;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'title', 'category', 'custom_icon', 'danger_level', 'status', 'description',
    'secrets', 'image_path', 'tags', 'is_secret', 'discovered_by_name', 'discovered_on', 'x', 'y',
])]
#[Hidden(['firestore_id'])]
class MapPin extends Model
{
    use HasPublicFiles;

    /**
     * Categorias do sistema antigo (CATEGORIES em WorldMap.tsx): rótulo,
     * ícone padrão (id no sprite) e cor. "city" antigo equivale a "town".
     *
     * @var array<string, array{label: string, short: string, icon: string, color: string, description: string}>
     */
    public const CATEGORIES = [
        'dungeon' => ['label' => 'Masmorra / Dungeon', 'short' => 'Dungeon', 'icon' => 'skull', 'color' => '#c084fc', 'description' => 'Catacumbas subterrâneas, labirintos sombrios, criptas e masmorras profundas'],
        'town' => ['label' => 'Cidade / Vila', 'short' => 'Cidade', 'icon' => 'castle', 'color' => '#34d399', 'description' => 'Cidades fortificadas, capitais, aldeias, entrepostos populosos e cidadelas'],
        'poi' => ['label' => 'Ponto de Interesse (POI)', 'short' => 'POI', 'icon' => 'sparkles', 'color' => '#22d3ee', 'description' => 'Monumentos mágicos, monólitos arcanos, anomalias celestes e marcos místicos'],
        'ruins' => ['label' => 'Ruínas Antigas', 'short' => 'Ruínas', 'icon' => 'landmark', 'color' => '#d6d3d1', 'description' => 'Cidades soterradas, templos profanados e civilizações esquecidas pelos deuses'],
        'nature' => ['label' => 'Floresta / Ermos', 'short' => 'Ermos', 'icon' => 'tree-pine', 'color' => '#2dd4bf', 'description' => 'Bosques ancestrais, picos montanhosos e desfiladeiros selvagens inexplorados'],
        'camp' => ['label' => 'Acampamento / Refúgio', 'short' => 'Acampamento', 'icon' => 'tent', 'color' => '#fbbf24', 'description' => 'Bivaques do grupo, postos avançados de patrulha e abrigos montados'],
        'danger' => ['label' => 'Área de Perigo / Covil', 'short' => 'Perigo', 'icon' => 'flame', 'color' => '#fb7185', 'description' => 'Ninhos de feras lendárias, covis de dragões e regiões com fendas elementais'],
        'tavern' => ['label' => 'Taverna / Entreposto', 'short' => 'Taverna', 'icon' => 'beer', 'color' => '#facc15', 'description' => 'Estalagens acolhedoras, feiras de mercadores e pontos seguros para descanso'],
        'port' => ['label' => 'Porto / Marítimo', 'short' => 'Porto', 'icon' => 'anchor', 'color' => '#60a5fa', 'description' => 'Docas marítimas, baías de ancoragem, ancoradouros e ilhas corsárias'],
        'sanctuary' => ['label' => 'Santuário / Templo', 'short' => 'Santuário', 'icon' => 'sun', 'color' => '#fcd34d', 'description' => 'Fontes consagradas, altares de bênção divina e templos iluminados'],
        'treasure' => ['label' => 'Tesouro / Relíquia', 'short' => 'Tesouro', 'icon' => 'gem', 'color' => '#a78bfa', 'description' => 'Baús perdidos, artefatos ancestrais, cofres trancados e riquezas esquecidas'],
        'tower' => ['label' => 'Torre / Fortaleza', 'short' => 'Torre', 'icon' => 'shield', 'color' => '#38bdf8', 'description' => 'Torres arcanas de magos, baluartes militares de sentinela e fortificações'],
    ];

    /**
     * Ícones escolhíveis (AVAILABLE_ICONS): nome antigo => [id no sprite, rótulo].
     *
     * @var array<string, array{0: string, 1: string}>
     */
    public const ICONS = [
        'Skull' => ['skull', 'Masmorra / Crânio'],
        'Castle' => ['castle', 'Castelo / Cidade'],
        'Sparkles' => ['sparkles', 'Ponto Místico (POI)'],
        'Landmark' => ['landmark', 'Monumento / Ruínas'],
        'TreePine' => ['tree-pine', 'Floresta / Bosque'],
        'Mountain' => ['mountain', 'Montanhas / Ermos'],
        'Tent' => ['tent', 'Acampamento / Refúgio'],
        'Flame' => ['flame', 'Covil / Fogo Hostil'],
        'Beer' => ['beer', 'Taverna / Caneca'],
        'Anchor' => ['anchor', 'Porto / Âncora'],
        'Sun' => ['sun', 'Santuário / Templo'],
        'Gem' => ['gem', 'Tesouro / Relíquia'],
        'Shield' => ['shield', 'Fortaleza / Defesa'],
        'Swords' => ['swords', 'Campo de Batalha'],
        'Compass' => ['compass', 'Bússola / Exploração'],
        'Eye' => ['eye', 'Torre de Vigia'],
        'Key' => ['key', 'Chave / Câmara Secreta'],
        'BookOpen' => ['book-open', 'Grimório / Lore'],
        'Crosshair' => ['crosshair', 'Objetivo de Missão'],
        'Flag' => ['flag', 'Bandeira / Posto Avançado'],
    ];

    /** @var array<string, string> */
    public const DANGER_LEVELS = [
        'safe' => 'Seguro',
        'moderate' => 'Moderado',
        'dangerous' => 'Perigoso',
        'deadly' => 'Letal',
    ];

    /** @var array<string, string> */
    public const STATUSES = [
        'sighted' => 'Apenas Avistado',
        'explored' => 'Em Exploração',
        'cleared' => 'Conquistado / Pacificado',
        'unexplored' => 'Rumor / Inexplorado',
    ];

    public function categoryKey(): string
    {
        $category = $this->category === 'city' ? 'town' : (string) $this->category;

        return array_key_exists($category, self::CATEGORIES) ? $category : 'poi';
    }

    /**
     * Dados para o navegador. Segredos e marcadores secretos só chegam ao mestre.
     *
     * @return array<string, mixed>
     */
    public function toMapArray(User $viewer, bool $isGm): array
    {
        $category = $this->categoryKey();

        return [
            'id' => $this->id,
            'title' => $this->title,
            'x' => $this->x,
            'y' => $this->y,
            'category' => $category,
            'icon' => self::ICONS[$this->custom_icon ?? ''][0] ?? self::CATEGORIES[$category]['icon'],
            'custom_icon' => array_key_exists((string) $this->custom_icon, self::ICONS) ? $this->custom_icon : null,
            'danger_level' => array_key_exists((string) $this->danger_level, self::DANGER_LEVELS) ? $this->danger_level : 'moderate',
            'status' => array_key_exists((string) $this->status, self::STATUSES) ? $this->status : 'explored',
            'description' => (string) $this->description,
            'secrets' => $isGm ? (string) $this->secrets : null,
            'is_secret' => $this->is_secret,
            'discovered_by' => $this->discovered_by_name,
            'discovered_on' => $this->discovered_on?->format('d/m/Y'),
            'discovered_on_value' => $this->discovered_on?->format('Y-m-d'),
            'image_url' => $this->image_url,
            'can_edit' => $isGm || $this->created_by === $viewer->id || $viewer->isAdmin(),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'is_secret' => 'boolean',
            'discovered_on' => 'date',
            'x' => 'float',
            'y' => 'float',
        ];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicFileUrl($this->image_path));
    }

    /**
     * @return BelongsTo<GameSession, $this>
     */
    public function gameSession(): BelongsTo
    {
        return $this->belongsTo(GameSession::class);
    }

    /**
     * @return BelongsTo<CampaignMap, $this>
     */
    public function campaignMap(): BelongsTo
    {
        return $this->belongsTo(CampaignMap::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
