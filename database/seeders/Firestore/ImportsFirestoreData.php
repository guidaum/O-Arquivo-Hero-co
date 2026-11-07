<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use App\Models\CampaignMap;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Utilitários compartilhados pelos seeders de importação do Firebase.
 *
 * @property \Illuminate\Console\Command|null $command
 */
trait ImportsFirestoreData
{
    /** @var array<class-string<Model>, array<string, int>> */
    private array $idMaps = [];

    /** @var array<string, int>|null */
    private ?array $presetMapIds = null;

    /** @var array<string, string> */
    private const ALLOWED_IMAGE_TYPES = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    /**
     * Cria ou atualiza o registro identificado pelo ID do Firestore.
     * Usa forceFill porque os dados vêm da exportação, não de uma requisição.
     *
     * @template TModel of Model
     *
     * @param  class-string<TModel>  $modelClass
     * @param  array<string, mixed>  $attributes
     * @return TModel
     */
    protected function upsertByFirestoreId(string $modelClass, string $firestoreId, array $attributes): Model
    {
        $model = $modelClass::query()->firstOrNew(['firestore_id' => $firestoreId]);
        $model->forceFill($attributes)->save();

        $this->idMaps[$modelClass][$firestoreId] = (int) $model->getKey();

        return $model;
    }

    /**
     * ID local correspondente a um ID do Firestore.
     *
     * @param  class-string<Model>  $modelClass
     */
    protected function localId(string $modelClass, mixed $firestoreId): ?int
    {
        if (! is_string($firestoreId) || $firestoreId === '') {
            return null;
        }

        if (! isset($this->idMaps[$modelClass])) {
            $this->idMaps[$modelClass] = $modelClass::query()
                ->whereNotNull('firestore_id')
                ->pluck('id', 'firestore_id')
                ->map(static fn (mixed $id): int => (int) $id)
                ->all();
        }

        return $this->idMaps[$modelClass][$firestoreId] ?? null;
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  iterable<mixed>|null  $firestoreIds
     * @return list<int>
     */
    protected function localIds(string $modelClass, ?iterable $firestoreIds): array
    {
        $ids = [];

        foreach ($firestoreIds ?? [] as $firestoreId) {
            $id = $this->localId($modelClass, $firestoreId);

            if ($id !== null) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Mapa a partir da chave usada no Firebase: a chave de um mapa padrão
     * ("catacombs") ou o ID de um mapa personalizado.
     */
    protected function campaignMapId(mixed $key): ?int
    {
        if (! is_string($key) || $key === '') {
            return null;
        }

        $this->presetMapIds ??= CampaignMap::query()
            ->whereNotNull('preset_key')
            ->pluck('id', 'preset_key')
            ->map(static fn (mixed $id): int => (int) $id)
            ->all();

        return $this->presetMapIds[$key] ?? $this->localId(CampaignMap::class, $key);
    }

    /**
     * Decompõe a chave "session_{sessão}_{mapa}" usada no battlemap.
     *
     * @return array{0: string|null, 1: string|null} [ID da sessão no Firestore, chave do mapa]
     */
    protected function splitDungeonKey(mixed $key): array
    {
        if (! is_string($key) || ! preg_match('/^session_([A-Za-z0-9]+)_(.+)$/', $key, $matches)) {
            return [null, null];
        }

        return [$matches[1], $matches[2]];
    }

    /**
     * Converte as datas do Firestore (ISO 8601, {seconds, nanoseconds} ou
     * milissegundos) para o fuso da aplicação, que é o usado na gravação.
     */
    protected function timestamp(mixed $value): ?Carbon
    {
        try {
            $date = match (true) {
                is_string($value) && $value !== '' => Carbon::parse($value),
                is_array($value) && isset($value['seconds']) => Carbon::createFromTimestamp((int) $value['seconds']),
                is_int($value) || is_float($value) => Carbon::createFromTimestampMs((int) $value),
                default => null,
            };
        } catch (Throwable) {
            return null;
        }

        return $date?->setTimezone((string) config('app.timezone'));
    }

    /**
     * Data simples ("2026-10-04"), ou null se inválida.
     */
    protected function date(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            return null;
        }

        return substr($value, 0, 10);
    }

    /**
     * Grava uma imagem em base64 no disco público e devolve o caminho.
     * URLs externas são mantidas como estão; qualquer outro valor vira null.
     */
    protected function storeImage(mixed $value, string $directory, string $name): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return mb_strlen($value) <= 255 ? $value : null;
        }

        if (! preg_match('/^data:([\w\/+.-]+);base64,(.+)$/s', $value, $matches)) {
            return null;
        }

        $extension = self::ALLOWED_IMAGE_TYPES[strtolower($matches[1])] ?? null;
        $contents = base64_decode($matches[2], true);

        if ($extension === null || $contents === false) {
            return null;
        }

        $path = $directory.'/'.$name.'.'.$extension;
        Storage::disk((string) config('arquivo.import.disk'))->put($path, $contents);

        return $path;
    }

    protected function nullableString(mixed $value, int $maxLength = 255): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : mb_substr($value, 0, $maxLength);
    }

    protected function integer(mixed $value, int $default = 0): int
    {
        return is_numeric($value) ? (int) round((float) $value) : $default;
    }

    protected function number(mixed $value, float $default = 0.0): float
    {
        return is_numeric($value) ? (float) $value : $default;
    }

    protected function report(string $label, int $imported, int $skipped = 0): void
    {
        $message = sprintf('%s: %d importado(s)', $label, $imported);

        if ($skipped > 0) {
            $message .= sprintf(', %d ignorado(s) por referência inválida', $skipped);
            $this->command?->warn($message);

            return;
        }

        $this->command?->info($message);
    }
}
