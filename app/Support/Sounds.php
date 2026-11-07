<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\CustomSound;
use App\Models\RuleSet;

/**
 * Catálogo de áudio (soundManager.ts e atmosphereEngine.ts do sistema antigo):
 * efeitos sonoros, ambientações procedurais e climas da masmorra.
 *
 * Cada efeito guarda um valor nas regras: vazio ou "synth:..." usa o som
 * sintetizado no navegador; "sound:<id>" aponta para a biblioteca
 * (custom_sounds); "http(s)://..." é um endereço externo.
 */
final class Sounds
{
    /** Efeito => [nome, categoria, descrição, coluna própria nas regras]. */
    public const EFFECTS = [
        'dice_roll' => ['Rolagem de Dados', 'dice', 'Chocalhar de dados rolando sobre a mesa.', 'dice_roll_sound'],
        'success' => ['Sucesso Normal', 'dice', 'Acorde harmônico indicando teste superado.', 'success_sound'],
        'failure' => ['Falha Normal', 'dice', 'Badalada melancólica indicando falha no teste.', 'failure_sound'],
        'critical' => ['Acerto Crítico (20 natural)', 'dice', 'Fanfarra gloriosa de acerto supremo.', 'critical_sound'],
        'fumble' => ['Falha Crítica (1 natural)', 'dice', 'Desastre retumbante.', 'fumble_sound'],
        'attack' => ['Golpe de Lâmina', 'combat', 'Corte rápido de espada ou machado.', null],
        'shield' => ['Bloqueio / Escudo', 'combat', 'Impacto metálico contra o escudo.', null],
        'arrow' => ['Disparo de Flecha', 'combat', 'Corda do arco e flecha cortando o ar.', null],
        'damage' => ['Impacto de Dano', 'combat', 'Golpe pesado acertando o alvo.', null],
        'spell' => ['Conjuração de Magia', 'magic', 'Energia arcana crescendo e explodindo.', null],
        'heal' => ['Cura Divina', 'magic', 'Acorde luminoso de cura.', null],
        'footsteps' => ['Passos na Masmorra', 'dungeon', 'Passos ecoando em corredores de pedra.', null],
        'trap' => ['Armadilha Disparada', 'dungeon', 'Mecanismo estalando de repente.', null],
        'chest' => ['Baú e Tesouro', 'dungeon', 'Tampa rangendo e moedas tilintando.', null],
        'door' => ['Porta Pesada', 'dungeon', 'Porta antiga rangendo nas dobradiças.', null],
        'ping' => ['Sinalizador no Mapa', 'system', 'Sinal sonoro de atenção.', null],
        'monster_roar' => ['Rugido de Monstro', 'system', 'Criatura rugindo nas sombras.', null],
        'level_up' => ['Subida de Nível', 'system', 'Fanfarra de conquista.', null],
        'combat_start' => ['Início de Combate', 'system', 'Tambores anunciando a batalha.', null],
    ];

    public const CATEGORIES = [
        'dice' => 'Dados e Desfechos',
        'combat' => 'Combate',
        'magic' => 'Magia',
        'dungeon' => 'Masmorra',
        'system' => 'Mesa',
        'ambient' => 'Ambientação',
    ];

    /** Ambientações procedurais (public/js/core/ambience.js): nome e descrição. */
    public const SOUNDSCAPES = [
        'dungeon_rain' => ['Chuva na Masmorra', 'Goteiras, chuva contínua e trovões distantes.'],
        'cold_wind' => ['Vento Gélido e Nevasca', 'Uivos congelantes de inverno.'],
        'tavern' => ['Taverna Aconchegante', 'Lareira crepitante e calor.'],
        'deep_cavern' => ['Caverna Profunda e Ecos', "Pingos d'água e drone abissal."],
        'combat_drums' => ['Combate Tenso e Tambores', 'Percussão marcial de guerra.'],
        'arcane_mystery' => ['Santuário Arcano', 'Taças de cristal e harmônicos.'],
    ];

    /** Climas visuais do battlemap (MapAtmosphereOverlay). */
    public const WEATHER = [
        'none' => 'Límpido',
        'rain' => 'Chuva e Tempestade',
        'fog' => 'Névoa Volumétrica',
        'embers' => 'Brasas e Fagulhas',
        'snow' => 'Neve e Nevasca',
    ];

    /** Formatos aceitos no envio para a biblioteca. */
    public const UPLOAD_MIMES = 'mp3,wav,ogg,oga,m4a,webm';

    public const UPLOAD_MAX_KB = 10240;

    /**
     * Valor gravado de cada efeito (como está nas regras).
     *
     * @return array<string, string|null>
     */
    public static function stored(?RuleSet $ruleSet): array
    {
        $extra = (array) ($ruleSet?->sound_settings ?? []);
        $values = [];

        foreach (self::EFFECTS as $key => [, , , $column]) {
            $value = $column !== null ? $ruleSet?->getAttribute($column) : ($extra[$key] ?? null);
            $values[$key] = is_string($value) && trim($value) !== '' ? trim($value) : null;
        }

        $values['custom_ambient'] = is_string($extra['custom_ambient'] ?? null) && $extra['custom_ambient'] !== '' ? $extra['custom_ambient'] : null;

        return $values;
    }

    /**
     * Endereço tocável de cada efeito (null = som sintetizado).
     *
     * @return array<string, string|null>
     */
    public static function urls(?RuleSet $ruleSet): array
    {
        $stored = self::stored($ruleSet);
        $ids = [];

        foreach ($stored as $value) {
            if ($value !== null && preg_match('/^sound:(\d+)$/', $value, $match) === 1) {
                $ids[] = (int) $match[1];
            }
        }

        $library = $ids === [] ? collect() : CustomSound::query()->whereKey($ids)->get()->keyBy('id');

        return array_map(static fn (?string $value): ?string => self::url($value, $library), $stored);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, CustomSound>|null  $library
     */
    public static function url(?string $value, ?\Illuminate\Support\Collection $library = null): ?string
    {
        if ($value === null || $value === '' || str_starts_with($value, 'synth:')) {
            return null;
        }

        if (preg_match('/^sound:(\d+)$/', $value, $match) === 1) {
            $sound = $library?->get((int) $match[1]) ?? CustomSound::query()->find((int) $match[1]);

            return $sound?->url;
        }

        return preg_match('#^https?://#i', $value) === 1 ? $value : null;
    }

    /**
     * Efeitos para o navegador, na ordem do catálogo.
     *
     * @return list<array{key: string, label: string, category: string}>
     */
    public static function effectList(): array
    {
        $list = [];

        foreach (self::EFFECTS as $key => [$label, $category]) {
            $list[] = ['key' => $key, 'label' => $label, 'category' => $category];
        }

        return $list;
    }
}
