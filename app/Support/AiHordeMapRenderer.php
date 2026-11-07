<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Refino de mapas pela IA gratuita do AI Horde (Stable Diffusion distribuído).
 *
 * Diferente do sistema antigo (rabisco cru, prompt único de Mercator e 15 s
 * de espera), aqui a IA recebe o mapa já ilustrado pelo cartógrafo do
 * navegador, com prompt próprio para mundo ou masmorra, prompt negativo,
 * fidelidade ajustável e, se pedido, ControlNet para seguir as linhas.
 * O pedido é assíncrono: a tela consulta o andamento até a imagem ficar pronta.
 */
final class AiHordeMapRenderer
{
    /** Temas de mapa do mundo: rótulo e descrição para a IA. */
    public const WORLD_THEMES = [
        'parchment' => ['Pergaminho medieval', 'fantasy world map, hand-drawn ink cartography on aged parchment paper, illustrated mountain ranges, forests drawn as tiny trees, winding rivers, coastline with wave hatching, compass rose, ornate border'],
        'painted' => ['Atlas pintado', 'fantasy world map, colorful hand-painted atlas, watercolor terrain, lush green lowlands, snowy mountain peaks, deep blue ocean, soft shading, detailed cartography'],
        'contemporary' => ['Relevo contemporâneo', 'topographic relief map, physical atlas style, realistic terrain shading, elevation tints, rivers and roads, satellite-like detail'],
        'futuristic' => ['Ficção científica', 'sci-fi planetary survey map, holographic cartography, glowing cyan contour lines on dark navy background, orbital grid, futuristic interface'],
    ];

    /** Temas de masmorra (battlemap). */
    public const DUNGEON_THEMES = [
        'stone' => ['Masmorra de pedra', 'stone dungeon with flagstone floors, thick stone walls, wooden doors, torches, scattered debris'],
        'cave' => ['Caverna natural', 'natural cave system with rough rock walls, uneven stone ground, stalagmites, puddles, moss'],
        'crypt' => ['Cripta sombria', 'ancient undead crypt with sarcophagi, bones, cobwebs, cracked tiles, candles'],
        'temple' => ['Templo arcano', 'arcane underground temple with glowing blue runes, marble floor, crystals, magic circles'],
        'volcanic' => ['Covil vulcânico', 'volcanic lair with rivers of glowing lava, obsidian floor, scorched rocks, embers'],
    ];

    /** Elementos do esboço em inglês, para enriquecer o prompt. */
    private const ELEMENT_WORDS = [
        'continente' => 'a large continent', 'ilhas' => 'islands', 'montanhas' => 'mountain ranges', 'florestas' => 'dense forests',
        'desertos' => 'deserts with dunes', 'terras_gelidas' => 'frozen tundra and glaciers', 'rios' => 'rivers', 'estradas' => 'roads',
        'cidades' => 'walled cities', 'vilas' => 'small villages', 'fazendas' => 'farmlands', 'catacumbas' => 'ruins and catacombs', 'cemiterios' => 'graveyards',
        'piso' => 'rooms and corridors', 'agua' => 'underground water pools', 'lava' => 'lava streams', 'porta' => 'doors', 'escada' => 'stairs',
        'pilar' => 'stone pillars', 'bau' => 'treasure chests', 'armadilha' => 'traps', 'altar' => 'an altar', 'escombros' => 'rubble',
    ];

    private const NEGATIVE = 'text, letters, words, labels, watermark, signature, logo, blurry, lowres, jpeg artifacts, people, characters, frame cut off, photo';

    private const DUNGEON_NEGATIVE = ', perspective, isometric, side view, 3d render';

    public function enabled(): bool
    {
        return (bool) config('services.ai_horde.enabled');
    }

    public function isAnonymous(): bool
    {
        return in_array((string) config('services.ai_horde.api_key'), ['', '0000000000'], true);
    }

    /**
     * Prompt completo no formato do AI Horde ("positivo ### negativo").
     *
     * @param  list<string>  $elements
     */
    public function prompt(string $type, string $theme, array $elements, string $extra = ''): string
    {
        $isDungeon = $type === 'dungeon';
        $themes = $isDungeon ? self::DUNGEON_THEMES : self::WORLD_THEMES;
        $description = $themes[$theme][1] ?? reset($themes)[1];
        $features = array_values(array_unique(array_filter(array_map(static fn (string $element): ?string => self::ELEMENT_WORDS[$element] ?? null, $elements))));

        $positive = $isDungeon
            ? 'top-down orthographic tabletop RPG battle map, '.$description
            : $description;

        if ($features !== []) {
            $positive .= ', featuring '.implode(', ', $features);
        }

        $extra = trim(preg_replace('/[^\pL\pN\s,.\'-]/u', ' ', $extra) ?? '');
        if ($extra !== '') {
            $positive .= ', '.mb_substr($extra, 0, 300);
        }

        $positive .= ', masterpiece, highly detailed, sharp focus';

        return $positive.' ### '.self::NEGATIVE.($isDungeon ? self::DUNGEON_NEGATIVE : '');
    }

    /**
     * Tamanho pedido à IA: mantém a proporção do esboço, lado maior de 768 px
     * (anônimo) ou 1024 px (com chave), sempre múltiplo de 64.
     *
     * @return array{0: int, 1: int}
     */
    public function size(int $width, int $height): array
    {
        $longest = $this->isAnonymous() ? 768 : 1024;
        $scale = $longest / max($width, $height, 1);
        $round = static fn (float $value): int => max(256, (int) (round($value / 64) * 64));

        return [$round($width * $scale), $round($height * $scale)];
    }

    /**
     * Envia o pedido. $fidelity (0–100): quanto o resultado respeita o desenho.
     *
     * @param  string  $imageBase64  imagem (webp/png) sem o prefixo data:
     * @return string id do pedido no AI Horde
     */
    public function submit(string $imageBase64, string $prompt, int $width, int $height, int $fidelity, bool $followLines, int $variations): string
    {
        [$width, $height] = $this->size($width, $height);
        // Fidelidade alta = pouca mudança (denoising baixo). Com ControlNet, as linhas seguram a forma.
        $denoise = round(0.8 - ($fidelity / 100) * 0.45, 2);

        $params = [
            'width' => $width,
            'height' => $height,
            'steps' => 30,
            'n' => max(1, min(4, $variations)),
            'cfg_scale' => 7,
            'sampler_name' => 'k_euler_a',
            'karras' => true,
            'denoising_strength' => $followLines ? max(0.75, $denoise) : $denoise,
        ];

        if ($followLines) {
            $params['control_type'] = 'fakescribbles';
            $params['control_strength'] = round(0.6 + ($fidelity / 100) * 0.6, 2);
        }

        $payload = [
            'prompt' => $prompt,
            'params' => $params,
            'source_image' => $imageBase64,
            'source_processing' => 'img2img',
            'nsfw' => false,
            'censor_nsfw' => true,
            'r2' => true,
        ];

        $models = config('services.ai_horde.models', []);
        if (is_array($models) && $models !== []) {
            $payload['models'] = $models;
        }

        try {
            $response = $this->client()->post('/generate/async', $payload);
        } catch (ConnectionException) {
            throw new RuntimeException('Não foi possível falar com o AI Horde agora. Tente de novo em instantes.');
        }

        if (! $response->successful() || ! is_string($response->json('id'))) {
            $reason = (string) $response->json('message', '');
            throw new RuntimeException('O AI Horde recusou o pedido'.($reason !== '' ? ': '.$reason : '.'));
        }

        return $response->json('id');
    }

    /**
     * Andamento: done, faulted, is_possible, queue_position, wait_time.
     *
     * @return array<string, mixed>
     */
    public function check(string $id): array
    {
        try {
            $response = $this->client()->get('/generate/check/'.rawurlencode($id));
        } catch (ConnectionException) {
            return ['done' => false, 'faulted' => false, 'is_possible' => true, 'unreachable' => true];
        }

        if ($response->status() === 404) {
            return ['done' => false, 'faulted' => true, 'expired' => true];
        }

        return (array) $response->json();
    }

    /**
     * Baixa as imagens prontas (conteúdo binário de cada variação).
     *
     * @return list<string>
     */
    public function images(string $id): array
    {
        $response = $this->client()->get('/generate/status/'.rawurlencode($id));
        $images = [];

        foreach ((array) $response->json('generations', []) as $generation) {
            $source = (string) ($generation['img'] ?? '');

            if (str_starts_with($source, 'http')) {
                $download = Http::timeout((int) config('services.ai_horde.timeout', 20))->get($source);
                if ($download->successful()) {
                    $images[] = $download->body();
                }
            } elseif ($source !== '') {
                $decoded = base64_decode($source, true);
                if ($decoded !== false) {
                    $images[] = $decoded;
                }
            }
        }

        return $images;
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.ai_horde.url'), '/'))
            ->timeout((int) config('services.ai_horde.timeout', 20))
            ->acceptJson()
            ->withHeaders([
                'apikey' => (string) config('services.ai_horde.api_key') ?: '0000000000',
                'Client-Agent' => 'arquivo-heroico:1.0:'.config('app.url'),
            ]);
    }
}
