<?php

declare(strict_types=1);

namespace Database\Seeders\Firestore;

use RuntimeException;

/**
 * Leitura do JSON exportado do Firestore (dump_data/firestore_dump.json).
 * O arquivo é carregado uma única vez por execução.
 */
final class FirestoreDump
{
    /** @var array<string, list<array{id: string, data: array<string, mixed>}>>|null */
    private static ?array $collections = null;

    public static function path(): string
    {
        return (string) config('arquivo.import.dump_path');
    }

    public static function exists(): bool
    {
        return is_file(self::path());
    }

    /**
     * @return list<array{id: string, data: array<string, mixed>}>
     */
    public static function collection(string $name): array
    {
        return self::load()[$name] ?? [];
    }

    /**
     * Documento pelo ID, ou null se não existir.
     *
     * @return array<string, mixed>|null
     */
    public static function document(string $collection, string $id): ?array
    {
        foreach (self::collection($collection) as $document) {
            if ($document['id'] === $id) {
                return $document['data'];
            }
        }

        return null;
    }

    /**
     * @return array<string, list<array{id: string, data: array<string, mixed>}>>
     */
    private static function load(): array
    {
        if (self::$collections !== null) {
            return self::$collections;
        }

        if (! self::exists()) {
            throw new RuntimeException('Arquivo de exportação do Firestore não encontrado: '.self::path());
        }

        $decoded = json_decode((string) file_get_contents(self::path()), true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($decoded)) {
            throw new RuntimeException('Arquivo de exportação do Firestore inválido.');
        }

        return self::$collections = $decoded;
    }
}
