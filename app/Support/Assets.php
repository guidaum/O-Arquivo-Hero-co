<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Endereços versionados dos arquivos estáticos de public/ (CSS, JS, sprite).
 *
 * A hospedagem (e a CDN na frente dela) guarda CSS e JS por dias. Sem versão
 * no endereço, uma cópia antiga ou quebrada continua sendo entregue depois de
 * cada atualização. A versão é a data de modificação do arquivo: muda sozinha
 * quando o arquivo muda e não precisa de etapa de build.
 *
 * Os módulos JS importam uns aos outros por caminho relativo (../core/http.js),
 * que o Blade não alcança; por isso o layout publica um import map que troca
 * cada endereço de public/js pelo endereço versionado.
 */
final class Assets
{
    /** @var array<string, string>|null */
    private static ?array $importMap = null;

    /**
     * asset() com ?v=<mtime>. Arquivo inexistente volta sem versão.
     */
    public static function url(string $path): string
    {
        $path = ltrim($path, '/');
        $url = asset($path);
        $file = public_path($path);

        return is_file($file) ? $url.'?v='.filemtime($file) : $url;
    }

    /**
     * Mapa "endereço sem versão" => "endereço versionado" de todos os módulos
     * em public/js (calculado uma vez por requisição).
     *
     * @return array<string, string>
     */
    public static function importMap(): array
    {
        if (self::$importMap !== null) {
            return self::$importMap;
        }

        $root = public_path('js');
        $map = [];

        if (is_dir($root)) {
            $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));

            foreach ($files as $file) {
                if (! $file instanceof \SplFileInfo || $file->getExtension() !== 'js') {
                    continue;
                }

                $relative = 'js/'.str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
                $map[asset($relative)] = asset($relative).'?v='.$file->getMTime();
            }
        }

        ksort($map);

        return self::$importMap = $map;
    }
}
