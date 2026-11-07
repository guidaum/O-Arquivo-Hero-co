@php
    $privacy = config('arquivo.privacy');
    $contact = $privacy['contact_email'];
@endphp

<x-layouts.guest title="Política de Privacidade" wide>
    <article class="legal">
        <p class="muted">
            Última atualização:
            {{ \Illuminate\Support\Carbon::parse($privacy['updated_at'])->translatedFormat('j \d\e F \d\e Y') }}
        </p>

        <p>
            O <strong>{{ config('app.name') }}</strong> é um site para grupos de RPG de mesa, com fichas de personagem,
            diário de sessões, mapas, chat e ferramentas para o Mestre. Esta política explica quais dados pessoais
            coletamos, para que os usamos e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018, LGPD).
        </p>

        <h2>1. Quem é o responsável pelos seus dados</h2>
        <p>
            O controlador dos dados é <strong>{{ $privacy['controller'] }}</strong>, que pode ser contatado pelo e-mail
            <a href="mailto:{{ $contact }}">{{ $contact }}</a>.
        </p>

        <h2>2. Quais dados coletamos</h2>
        <h3>Dados da sua conta</h3>
        <ul>
            <li>Nome e e-mail.</li>
            <li>Senha, guardada de forma criptografada (<em>hash</em>): nem nós conseguimos lê-la.</li>
            <li>
                Se você entrar com o Google: o identificador da sua conta Google, além do nome e do e-mail informados
                por ele. Não temos acesso à sua senha do Google.
            </li>
        </ul>

        <h3>Dados que você escolhe informar no perfil</h3>
        <ul>
            <li>Foto, biografia, localização e telefone. Todos são opcionais.</li>
        </ul>

        <h3>Conteúdo que você cria no site</h3>
        <ul>
            <li>Personagens e fichas: atributos, perícias, poderes, vantagens, inventário, anotações e imagens.</li>
            <li>Entradas do diário, linha do tempo, NPCs e imagens da galeria.</li>
            <li>Mensagens e rolagens de dados no chat das sessões, incluindo menções a outros jogadores.</li>
            <li>Mapas, marcações, desenhos e sugestões de conteúdo enviadas à administração.</li>
        </ul>

        <h3>Dados de uso</h3>
        <ul>
            <li>Data e hora do seu último acesso.</li>
            <li>
                Registros técnicos do servidor (endereço IP, data e hora das requisições), usados para segurança e
                correção de erros.
            </li>
        </ul>
        <p>Não usamos ferramentas de análise de tráfego nem de publicidade, e não vendemos dados.</p>

        <h2>3. Para que usamos os dados</h2>
        <ul>
            <li><strong>Criar e manter a sua conta</strong> e permitir o seu acesso.</li>
            <li><strong>Fazer o site funcionar:</strong> mostrar suas fichas, sessões, chat e mapas aos participantes certos.</li>
            <li><strong>Enviar e-mails do serviço</strong>, como o link de primeiro acesso e o de redefinição de senha.</li>
            <li><strong>Proteger o site</strong> contra acessos indevidos (por exemplo, limitando tentativas de login).</li>
        </ul>

        <h2>4. Bases legais</h2>
        <p>Tratamos seus dados com base:</p>
        <ul>
            <li>na <strong>execução do serviço</strong> que você solicitou ao criar a conta (art. 7º, V, da LGPD);</li>
            <li>no seu <strong>consentimento</strong>, para os dados opcionais do perfil (art. 7º, I);</li>
            <li>no <strong>legítimo interesse</strong> de manter o site seguro (art. 7º, IX).</li>
        </ul>

        <h2>5. Quem pode ver os seus dados</h2>
        <ul>
            <li>
                <strong>Participantes das suas sessões:</strong> o Mestre e os jogadores de uma sessão veem os
                personagens, as mensagens do chat e os mapas daquela sessão.
            </li>
            <li>
                <strong>Administradores do site:</strong> podem acessar os dados quando necessário para manutenção e
                suporte.
            </li>
            <li>
                <strong>Prestadores de serviço</strong> que tornam o site possível: a hospedagem e o banco de dados
                ({{ $privacy['hosting_provider'] }}), o envio de e-mails ({{ $privacy['mail_provider'] }}) e o Google,
                apenas se você escolher entrar com a conta Google.
                @if ($privacy['ai_maps_service'])
                    Ao usar a geração de mapas por inteligência artificial, o esboço enviado é processado por
                    {{ $privacy['ai_maps_service'] }}.
                @endif
            </li>
        </ul>
        <p>Seus dados não são compartilhados com terceiros para outras finalidades.</p>

        <h2>6. Cookies e armazenamento no navegador</h2>
        <p>Usamos apenas o essencial:</p>
        <ul>
            <li><strong>Cookie de sessão:</strong> mantém você conectado.</li>
            <li><strong>Cookie de segurança (CSRF):</strong> protege os formulários contra envios forjados.</li>
            <li><strong>Preferência de tema claro/escuro:</strong> guardada no próprio navegador.</li>
        </ul>
        <p>Não usamos cookies de rastreamento ou de publicidade.</p>

        <h2>7. Por quanto tempo guardamos os dados</h2>
        <p>
            Guardamos seus dados enquanto a sua conta existir. Se você pedir a exclusão, apagaremos a conta e o
            conteúdo pessoal associado em até {{ $privacy['deletion_days'] }} dias. A exceção são os dados que
            precisemos manter por obrigação legal.
        </p>
        <p>
            Mensagens enviadas em sessões compartilhadas podem continuar visíveis aos demais participantes, sem
            identificação, quando isso for necessário para manter o histórico da campanha.
        </p>

        <h2>8. Segurança</h2>
        <p>
            Usamos conexão criptografada (HTTPS), senhas guardadas com <em>hash</em> e controle de acesso por
            permissões. Nenhum sistema é totalmente imune a falhas. Se ocorrer um incidente que traga risco a você,
            avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD), como exige a lei.
        </p>

        <h2>9. Seus direitos</h2>
        <p>Pela LGPD, você pode pedir a qualquer momento:</p>
        <ul>
            <li>confirmação de que tratamos seus dados e acesso a eles;</li>
            <li>correção de dados incompletos ou desatualizados;</li>
            <li>exclusão dos dados e da conta;</li>
            <li>portabilidade dos dados;</li>
            <li>informações sobre com quem eles são compartilhados;</li>
            <li>revogação do consentimento para os dados opcionais.</li>
        </ul>
        <p>
            Boa parte dos dados pode ser alterada diretamente na página <strong>Meu perfil</strong>. Para os demais
            pedidos, escreva para <a href="mailto:{{ $contact }}">{{ $contact }}</a>. Responderemos em até
            {{ $privacy['response_days'] }} dias.
        </p>

        <h2>10. Crianças e adolescentes</h2>
        <p>
            Se o usuário tiver menos de 18 anos, recomendamos que o cadastro seja feito com o conhecimento de um
            responsável. Menores de 12 anos só podem usar o site com o consentimento de um dos pais ou responsável
            legal, conforme o art. 14 da LGPD.
        </p>

        <h2>11. Alterações nesta política</h2>
        <p>
            Podemos atualizar esta política quando o site mudar. A data no topo indica a última versão. Mudanças
            importantes serão avisadas no próprio site.
        </p>

        <h2>12. Contato</h2>
        <p>Dúvidas sobre privacidade: <a href="mailto:{{ $contact }}">{{ $contact }}</a>.</p>
    </article>

    <div class="auth__links">
        @auth
            <a href="{{ route('dashboard') }}">Voltar ao início</a>
        @else
            <a href="{{ route('login') }}">Voltar para o login</a>
        @endauth
    </div>
</x-layouts.guest>
