<?php

declare(strict_types=1);

namespace App\Support;

use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Textos em português dos erros HTTP, usados pelas páginas de erro
 * (resources/views/errors, componente x-error-page) e pelas respostas JSON
 * dos pedidos fetch (bootstrap/app.php).
 *
 * A mensagem da exceção só aparece quando foi escrita pelo sistema, como em
 * abort(403, 'Só o mestre...'). Os padrões do framework ("This action is
 * unauthorized.", "No query results for model [App\Models\...]") ficam de
 * fora: estão em inglês e o segundo expõe nomes internos. Erros 5xx nunca
 * mostram a mensagem, que pode conter detalhes do servidor.
 */
final class HttpErrors
{
    /** @var array<int, array{title: string, message: string, icon: string}> */
    private const PAGES = [
        401 => ['title' => 'Identifique-se, viajante', 'message' => 'Entre na sua conta para abrir este tomo.', 'icon' => 'key'],
        403 => ['title' => 'Passagem selada', 'message' => 'Você não tem permissão para acessar esta página ou realizar esta ação.', 'icon' => 'lock'],
        404 => ['title' => 'Página perdida nos arquivos', 'message' => 'O que você procura não existe, foi removido ou mudou de lugar.', 'icon' => 'compass'],
        405 => ['title' => 'Caminho inválido', 'message' => 'Esta ação não pode ser feita por este caminho.', 'icon' => 'compass'],
        413 => ['title' => 'Carga pesada demais', 'message' => 'O arquivo enviado é grande demais. Escolha um arquivo menor.', 'icon' => 'weight'],
        419 => ['title' => 'A página expirou', 'message' => 'Sua sessão expirou por inatividade. Volte, recarregue a página e tente de novo.', 'icon' => 'clock'],
        429 => ['title' => 'Calma, aventureiro', 'message' => 'Muitas ações seguidas. Aguarde um instante e tente novamente.', 'icon' => 'clock'],
        500 => ['title' => 'Um feitiço falhou', 'message' => 'Algo deu errado do nosso lado. Tente novamente em alguns instantes.', 'icon' => 'alert-triangle'],
        503 => ['title' => 'Em manutenção', 'message' => 'O arquivo está passando por manutenção. Volte em alguns minutos.', 'icon' => 'hammer'],
    ];

    /** Mensagens padrão do framework, que nunca chegam ao usuário. */
    private const FRAMEWORK_MESSAGES = [
        'This action is unauthorized.',
        'Unauthenticated.',
        'CSRF token mismatch.',
        'Not found.',
        'Bad request.',
        'Too Many Attempts.',
        'Server Error',
    ];

    /**
     * @return array{title: string, message: string, icon: string}
     */
    public static function page(int $status): array
    {
        return self::PAGES[$status]
            ?? ($status >= 500 ? self::PAGES[500] : ['title' => 'Não foi possível continuar', 'message' => 'O pedido não pôde ser atendido. Volte e tente novamente.', 'icon' => 'alert-circle']);
    }

    /**
     * Mensagem para o usuário: a do sistema, quando houver, ou a padrão do código.
     */
    public static function message(int $status, ?Throwable $exception = null): string
    {
        $custom = trim((string) $exception?->getMessage());

        if ($status < 500 && $custom !== '' && ! self::isFrameworkMessage($custom)) {
            return $custom;
        }

        return self::page($status)['message'];
    }

    public static function status(Throwable $exception): int
    {
        return $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
    }

    private static function isFrameworkMessage(string $message): bool
    {
        return in_array($message, self::FRAMEWORK_MESSAGES, true)
            || str_starts_with($message, 'No query results for model')
            // "The route ... could not be found.", "The GET method is not supported ..."
            || str_starts_with($message, 'The ');
    }
}
