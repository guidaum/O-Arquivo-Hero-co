<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PowerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('powers')->delete();

        $records = [
            [
                'id' => '0YHVfehDHBoKZUfKacdv',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Canção Motivadora',
                'cost' => '5',
                'effect' => null,
                'description' => 'Durante 2 turnos, provoca desvantagem no ataque dos inimigos e vantagem para os aliados.',
                'created_at' => '2026-03-31T14:27:25.060Z',
                'updated_at' => '2026-03-31T22:14:09.943Z'
            ],
            [
                'id' => '0wfZP2wm5pMD5GlSeokb',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Translucidez',
                'cost' => '7',
                'effect' => null,
                'description' => 'Permite que o jogador desvie a luz, do espectro visível, que atinge seu corpo, deixando-o translúcido. Parado ele é quase invisível, quando se movimenta é possível ver uma estranha silhueta se deslocando.',
                'created_at' => '2026-04-01T11:27:58.300Z',
                'updated_at' => '2026-04-01T13:34:01.351Z'
            ],
            [
                'id' => '10CSKqlWrOp4HTO0oyRA',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Velocidade de Ataque',
                'cost' => '10',
                'effect' => null,
                'description' => 'Você ataca duas vezes ou mais dependendo do nível.',
                'created_at' => '2026-04-02T10:21:43.388Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '1AizkjXZDAl67LLcKQNl',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Contador de histórias',
                'cost' => '1',
                'effect' => null,
                'description' => 'Sobrenaturalmente as pessoas acreditam em você. Mesmo que a história seja mirabolante, após um teste falhar, com desvantagem, em convicção, o oponente acreditará em você. (Exemplo: Meu avô foi o maior produtor de mel do norte de Minas, porque ele cruzou abelhas com vagalumes, dessa forma as abelhas trabalham de dia e de noite à luz de suas velas.)',
                'created_at' => '2026-03-31T14:24:04.423Z',
                'updated_at' => '2026-03-31T22:14:02.332Z'
            ],
            [
                'id' => '2OJX1HC5rKnETeooJ28J',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Telepatia',
                'cost' => '15',
                'effect' => null,
                'description' => 'Você pode transmitir pensamentos. Em níveis mais altos pode escutar o que as pessoas pensam.',
                'created_at' => '2026-04-02T10:28:25.178Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '5PXWIOkn0UUAdjxPHxdD',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Impulso',
                'cost' => '7',
                'effect' => null,
                'description' => 'Você pula alto.',
                'created_at' => '2026-04-01T13:38:17.104Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '5diFrJLyVGe9viaHmReX',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Ventriloquismo',
                'cost' => '7',
                'effect' => null,
                'description' => 'Você pode fazer com que sua voz seja projetada longe de você.',
                'created_at' => '2026-04-02T10:05:12.067Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '5ruhwxVJACQDNETdN1Kz',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Visão Tática',
                'cost' => '1',
                'effect' => null,
                'description' => 'Você vê de forma analítica como uma máquina, consegue calcular distâncias, trajetórias e suas relações. +1 de bônus em testes de esquiva, defesa ou atributos, talentos relacionados com habilidades táticas ou na E/N do inimigo.',
                'created_at' => '2026-04-12T12:57:06.101Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '6DMAtL0fScJGykNSjkOJ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Fator de Cura',
                'cost' => '15',
                'effect' => '1d4 + CON',
                'description' => 'Você tem o poder de se auto curar.',
                'created_at' => '2026-04-02T10:26:53.081Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '6agZgTY1UTep2w6K4wxJ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Deslocamento Superior',
                'cost' => '7',
                'effect' => null,
                'description' => 'Você se desloca sobrenaturalmente deixando um rastro do seu trajeto para trás. Distância máxima de 10 metros, pode aumentar de acordo com o nível.',
                'created_at' => '2026-04-01T12:49:58.691Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => '9T3OQRwIcBfbKlstsTju',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Explosão Elemental',
                'cost' => '40',
                'effect' => '1d12 + INT + FOR',
                'description' => 'Você causa uma explosão do elemento pré-definido. Os efeitos dependem do elemento escolhido.',
                'created_at' => '2026-04-02T10:18:49.169Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'AuMbF5qAoH9EvWGnCiN6',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Sonorização',
                'cost' => '8',
                'effect' => null,
                'description' => 'Você consegue imitar sons e vozes.',
                'created_at' => '2026-04-02T10:07:54.838Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'CQIb4jK2cldmu3q1mpCC',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Velocidade Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Velocidade',
                'created_at' => '2026-03-31T22:17:33.712Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'CxrpHNEfl9RoVgZQCLbZ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Potência',
                'cost' => '10',
                'effect' => '3d4 + FOR',
                'description' => 'Seus golpes são muito fortes e projetam o adversário para longe.',
                'created_at' => '2026-04-02T10:09:30.587Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'FNnsnVDCrZiDzruni5qq',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Percepção Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Percepção',
                'created_at' => '2026-03-31T22:16:46.673Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'FmzMxZD8fYp3L6OCPCFg',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Atordoar',
                'cost' => '5',
                'effect' => '1D4 + FOR',
                'description' => 'Com um golpe poderoso, você atordoa o inimigo, por um turno ou mais dependendo do nível do poder.',
                'created_at' => '2026-04-02T08:14:07.241Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'GmlKvKWQBeHvRPfkugmg',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Poder Acelerado',
                'cost' => '25',
                'effect' => null,
                'description' => 'Você consegue utilizar dois ou mais poderes dependendo do seu nível.',
                'created_at' => '2026-04-02T10:23:05.039Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'H2ygOewFX0ICqqQc9KCg',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Levitar',
                'cost' => '7',
                'effect' => null,
                'description' => 'Você levita, lentamente, a poucos metros do chão, não consegue atravessar buracos profundos, porém com níveis maiores a velocidade e altitude aumentam.',
                'created_at' => '2026-04-01T13:36:38.988Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'J2JvmRA4WlkUhT6gFLnz',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Visão de Calor',
                'cost' => '1',
                'effect' => null,
                'description' => 'Você consegue ver as ondas de calor emitidas por pessoas, animais e objetos.',
                'created_at' => '2026-04-12T12:52:14.169Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'MpKi1bQI7uORTnQ1LW10',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Reação Corporal',
                'cost' => '15',
                'effect' => '1d4 + CON + FOR',
                'description' => 'Seu corpo reage à agressão agredindo de volta. A melhor defesa é um bom ataque. A reação do seu corpo pode variar: espinhos, descargas elétricas ou um movemento involuntário, depende do seu personagem e da narrativa da história.',
                'created_at' => '2026-04-02T08:20:12.919Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'OHOtBP1xetoIS6Rq7ukY',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Onda Elemental',
                'cost' => '25',
                'effect' => '1d6 + FOR',
                'description' => 'Você cria uma onda de elemento pré-definido, que empurra o alvo. Os efeitos dependem do elemento escolhido.',
                'created_at' => '2026-04-02T10:20:11.362Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'PsyPc7fQ728b5KibX2Bg',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Controle Mental',
                'cost' => '30',
                'effect' => null,
                'description' => 'Com sua mente você controla as ações de outra pessoa e ela acredita que são ações dela até o controle passar. Perdendo em um teste de defesa mental com duas vantagens, o alvo pode atentar contra a própria vida.',
                'created_at' => '2026-04-02T10:03:58.487Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'QwloqtkSBZtBP7GPzOqr',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Projeção Astral',
                'cost' => '10',
                'effect' => null,
                'description' => 'Você consegue se deslocar com sua consciência independente do corpo. Seu corpo fica vulnerável.',
                'created_at' => '2026-03-31T16:05:52.463Z',
                'updated_at' => '2026-03-31T22:14:20.201Z'
            ],
            [
                'id' => 'RPzeSSOjAcvVsnuRiuph',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Imaterialidade',
                'cost' => '10',
                'effect' => null,
                'description' => 'Você se torna imaterial por um curto período de tempo, conseguindo atravessar a matéria e não ser atingido por ela. Estranhamente você não fica invisível.',
                'created_at' => '2026-04-02T08:16:14.310Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'S9bjXat6Wz1ocEMVVvs6',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Indução Auditiva',
                'cost' => '15',
                'effect' => null,
                'description' => 'Mentalmente você induz a pessoa a acreditar que ouviu algo.',
                'created_at' => '2026-04-02T10:00:21.618Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'U8UpXZAK4f25UtPgKPJj',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Telecinese',
                'cost' => '15',
                'effect' => null,
                'description' => 'Você consegue mover objetos inanimados com a mente.',
                'created_at' => '2026-04-02T10:30:49.371Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'UMFOJvdiPb5em9mJje3W',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Empatia Elemental',
                'cost' => '2',
                'effect' => null,
                'description' => 'Manipular o elemento escolhido não causa os efeitos esperados.',
                'created_at' => '2026-04-03T09:54:05.036Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'VBeJtRkVsuJWLF9G06gV',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Força Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Força',
                'created_at' => '2026-03-31T22:13:49.275Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'WeyKUFS9EoKVdqfJYBgW',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Invisibilidade',
                'cost' => '10',
                'effect' => null,
                'description' => 'Permite que o jogador não reflita a luz, do espectro visível, que atinge seu corpo, deixando-o invisível. Em níveis maiores, luzes do espectro infravermelho e ultravioleta também são ignoradas.',
                'created_at' => '2026-04-01T11:25:36.120Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'WvED4sMTyIMbbvGV0NiI',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Sobressair',
                'cost' => '8',
                'effect' => null,
                'description' => 'Ao saltar por um breve momento, você pisa no ar como se fosse um bloco sólido, permitindo um novo salto.',
                'created_at' => '2026-04-02T10:13:05.013Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'YlBtAozBUBMZdPAORuOi',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'gt: bomba nula',
                'cost' => '25',
                'effect' => '2d20+anulado',
                'description' => 'O meu Deus o que é iss- KABOOM',
                'created_at' => '2026-10-06T21:16:43.015Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'Z2GjnHlPQgbq16fcqvIn',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'gt: ocultismo',
                'cost' => '50',
                'effect' => 'Depende',
                'description' => 'Sim salabim eu invoco pedra no rim',
                'created_at' => '2026-10-06T21:13:37.987Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'buPNGNaMEYiSLkmMdzcx',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Psionismo',
                'cost' => '50',
                'effect' => null,
                'description' => 'Você possui todas as habilidades mentais, pode desde induzir pensamentos, até mover corpos vivos, simular o próprio voo e muito mais. Claro dentro da força do seu nível de personagem e poder, lembrando que tudo está à mercê da interpretação do mestre.',
                'created_at' => '2026-04-02T10:33:59.530Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'cfVaSnxBmmU1CsDQT5y9',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Inspiração',
                'cost' => '15',
                'effect' => null,
                'description' => 'As próximas duas ações do companheiro alvo serão sucesso.',
                'created_at' => '2026-04-02T09:57:25.317Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'etyGDgICoZ0WtjArbXtQ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Audição Mental',
                'cost' => '15',
                'effect' => null,
                'description' => 'Você escuta os pensamentos alheios.',
                'created_at' => '2026-04-02T10:29:07.669Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'fhtcrFCltOCqQkE2Ejz4',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Rajada de Energia Elemental',
                'cost' => '30',
                'effect' => '1d6 + INT',
                'description' => 'Você emite uma rajada de energia de elemento e origens pré-definidos. Os efeitos dependem do elemento e nível.',
                'created_at' => '2026-04-02T10:15:44.120Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'gTnDdMekubNq5NQ6spxx',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Iniciativa Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Iniciativa',
                'created_at' => '2026-03-31T22:18:06.219Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'hnGzvqb2Lh1lGq8TWWx0',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Campo de força',
                'cost' => '10',
                'effect' => null,
                'description' => 'Uma barreira invisível que te defende por um turno ou mais dependendo do nível, ela fica parcialmente visível ao ser atingida.',
                'created_at' => '2026-04-02T09:53:29.428Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'jZWFqJesm3jwz33AqE6L',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Indução Mental',
                'cost' => '15',
                'effect' => null,
                'description' => 'Mentalmente você induz os pensamentos de outra pessoa.',
                'created_at' => '2026-04-02T09:59:08.142Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'japQQnqWhFoNCnvNipNE',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Constituição Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Constituição',
                'created_at' => '2026-03-31T22:14:59.910Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'jqSg5Zvvv7XrTNynlGBQ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Inteligência Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Inteligência',
                'created_at' => '2026-03-31T22:18:42.314Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'k3NrAFONzJ80w26I6jSH',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Aderir',
                'cost' => '7',
                'effect' => null,
                'description' => 'Você consegue escalar superfícies muito íngremes, quase planas. Com níveis mais altos, você consegue escalar no vidro e ficar de cabeça para baixo em superfícies lisas.',
                'created_at' => '2026-04-01T12:57:40.705Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'kX7qDTZGbzJfTCtsN7aF',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Magnetismo',
                'cost' => '10',
                'effect' => null,
                'description' => 'Você consegue atrair objetos ferromagnéticos, imantar e desimantar outros objetos, dentro de uma escala de peso variando pelo seu nível.',
                'created_at' => '2026-04-02T09:55:37.814Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'm8WGFypgAPlhMGSbYTPI',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Combinar Poderes',
                'cost' => '25',
                'effect' => null,
                'description' => 'Você pode combinar dois ou mais poderes, dependendo do nível, para gerar um terceiro, mediante interpretação da lógica do mestre.',
                'created_at' => '2026-04-02T10:24:31.837Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'mtO2zEsJ0WOyGKHRQOr0',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Coragem Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Coragem',
                'created_at' => '2026-03-31T22:19:05.167Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'nQ2aywbTcTisF42mIXtQ',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Intimidação',
                'cost' => '5',
                'effect' => null,
                'description' => 'Após falhar em um teste de coragem com desvantagem, o inimigo fica amedrontado, podendo fugir ou mudar de alvo, mediante a testes de coragem.',
                'created_at' => '2026-03-31T14:34:11.331Z',
                'updated_at' => '2026-03-31T22:14:27.737Z'
            ],
            [
                'id' => 'nuVw5i8Ls4vNzeVv4E7H',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Reflexo Superior',
                'cost' => '10',
                'effect' => null,
                'description' => 'Você consegue desviar instintivamente de ataques. 
"Você está começando a acreditar..."',
                'created_at' => '2026-04-01T12:55:51.108Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'o9OkUHaVY93dW5h7tBjz',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Curar',
                'cost' => '15',
                'effect' => '1d6 + CON',
                'description' => 'Você pode curar um ser vivo alvo.',
                'created_at' => '2026-04-02T10:26:04.452Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'olJJtbaV9QPoxxzjZPE2',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Metamorfose',
                'cost' => '15',
                'effect' => null,
                'description' => 'Você pode mudar sua aparência se transformando em outra pessoa. Com níveis maiores pode se transformar em outras criaturas.',
                'created_at' => '2026-04-02T10:10:58.433Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'pVjev66i5JjNn6eloAy8',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Visão Noturna',
                'cost' => null,
                'effect' => null,
                'description' => 'Você consegue ver no escuro, desde que não seja escuridão total.',
                'created_at' => '2026-04-12T12:49:57.887Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'rUhObbFhw4EZsoQJOvMh',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Indução Visual',
                'cost' => '15',
                'effect' => null,
                'description' => 'Mentalemente você induz a pessoa a acreditar que viu algo.',
                'created_at' => '2026-04-02T10:01:09.508Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'rcrGQDQ4fPiI9Vu0vDg2',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Voar',
                'cost' => '10',
                'effect' => null,
                'description' => 'Você voa... igual uma galinha, por alguns metros. Com níveis maiores alcança voos maiores.',
                'created_at' => '2026-04-01T12:51:23.920Z',
                'updated_at' => '2026-04-01T13:36:59.069Z'
            ],
            [
                'id' => 'vmWIOULyE8SXqlSOhhCN',
                'session_id' => null,
                'gm_id' => null,
                'name' => 'Visão Umbrosa',
                'cost' => '1',
                'effect' => null,
                'description' => 'Você consegue ver no escuro total.',
                'created_at' => '2026-04-12T12:50:57.989Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ],
            [
                'id' => 'z9ZDjgFvgJnTIy4qHJEe',
                'session_id' => 'UWxzeF8MmW7OtTnQTkz0',
                'gm_id' => 'faevHqwtOgSKvCHFscTAdEoUx8H2',
                'name' => 'Agilidade Superior',
                'cost' => null,
                'effect' => null,
                'description' => 'Confere modificador de +1 por nível para Agilidade',
                'created_at' => '2026-03-31T22:15:58.858Z',
                'updated_at' => '2026-11-03T10:25:53.036Z'
            ]
        ];

        foreach (array_chunk($records, 50) as $chunk) {
            DB::table('powers')->insert($chunk);
        }
    }
}
