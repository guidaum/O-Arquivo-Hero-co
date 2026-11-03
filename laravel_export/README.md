# Exportação de Dados e Migrations Laravel

Este pacote contém todas as migrations, seeders e dados exportados do sistema RPG.

## Estrutura
- `database/migrations/`: Todas as migrações de tabelas estruturadas com Blueprint.
- `database/seeders/`: Todos os seeders contendo todos os dados reais (usuários, personagens, sessões, talentos, poderes, etc.).
- `database/seeders/DatabaseSeeder.php`: Seeder mestre para executar `php artisan db:seed`.
- `storage/app/public/images/`: Todas as imagens (mapas de masmorras, mapas de mundo, avatares de personagens decodificados de Base64 para arquivos JPG/PNG, itens e campanhas).
- `dump.sql`: Dump direto SQL para importação instantânea em MySQL/PostgreSQL.

## Como Usar no Laravel:
1. Copie a pasta `database/migrations/*` para o diretório `database/migrations/` do seu projeto Laravel.
2. Copie a pasta `database/seeders/*` para o diretório `database/seeders/` do seu projeto Laravel.
3. Copie a pasta `storage/app/public/images/` para `storage/app/public/images/` do Laravel e execute:
   ```bash
   php artisan storage:link
   ```
4. Execute as migrations e os seeders:
   ```bash
   php artisan migrate:fresh --seed
   ```
