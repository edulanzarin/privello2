# Requirements Document

## Introduction

A Privello é uma plataforma web brasileira inspirada em modelos como o Fatal Model, onde acompanhantes podem manter um perfil público com mídias e clientes podem consumir esse conteúdo. A experiência de perfil é semelhante ao Instagram, com identificadores únicos no formato `@usuario`.

Este documento cobre o escopo inicial do produto, focado nos fluxos fundamentais que destravam o resto da plataforma:

1. Cadastro e login para clientes e acompanhantes
2. Cadastro simplificado de cliente
3. Onboarding em etapas para acompanhantes, com integração à API do IBGE para estados e cidades, e com persistência atômica (tudo ou nada)
4. Seleção de plano (Básico ou Premium) após o onboarding da acompanhante
5. Base técnica preparada para extensão futura (feed, stories, busca, upload de mídias no Cloudflare R2, pagamentos recorrentes via Mercado Pago)

A stack alvo é Next.js, PostgreSQL, Docker e deploy no Railway, com Cloudflare R2 para mídias e Mercado Pago para pagamentos. As chaves de API e segredos serão geridos por variáveis de ambiente. O foco inicial é desenvolvimento local com Docker totalmente estruturado.

Os requisitos deste documento descrevem **o quê** o sistema deve fazer. Decisões de arquitetura, modelagem de dados, contratos de API e implementação ficam para o documento de design.

## Glossary

- **Privello**: Plataforma web descrita por este documento.
- **Cliente**: Usuário que se cadastra para consumir conteúdo de acompanhantes.
- **Acompanhante**: Usuária que se cadastra para publicar perfil e mídias e que assina um Plano.
- **Usuario**: Termo genérico que abrange Cliente e Acompanhante.
- **Identificador**: Handle público e único de um Usuario, no formato `@valor`, análogo ao Instagram.
- **Onboarding_Acompanhante**: Fluxo de cadastro em múltiplas etapas exclusivo de Acompanhantes, antes da Selecao_de_Plano.
- **Selecao_de_Plano**: Etapa final do cadastro de Acompanhante onde a usuária escolhe entre Plano_Basico e Plano_Premium.
- **Plano_Basico**: Assinatura que permite até 10 mídias além da Foto_de_Perfil e não dá prioridade em buscas.
- **Plano_Premium**: Assinatura que permite até 50 mídias, publicação de Stories, Áudio_de_Apresentação ("Ouça minha voz") e prioridade em buscas (demais benefícios serão definidos posteriormente).
- **Audio_de_Apresentação**: Recurso exclusivo do Plano_Premium que permite à Acompanhante anexar uma faixa de áudio curta ao seu perfil, seja por upload de arquivo ou por gravação direto no navegador.
- **Foto_de_Perfil**: Imagem principal do perfil de um Usuario, contada à parte do limite de mídias do Plano. Obrigatória para Acompanhante (parte do Onboarding_Acompanhante) e opcional para Cliente (oferecida no formulário de cadastro).
- **API_IBGE**: API pública do Instituto Brasileiro de Geografia e Estatística usada para listar estados e cidades brasileiras.
- **Sistema_de_Autenticacao**: Componente responsável por login, sessão, hash de senha e diferenciação de tipos de Usuario.
- **Sistema_de_Cadastro_Cliente**: Componente responsável pelo cadastro de Clientes.
- **Sistema_de_Onboarding**: Componente responsável pelo Onboarding_Acompanhante, incluindo persistência atômica.
- **Sistema_de_Planos**: Componente responsável pela Selecao_de_Plano e por registrar o Plano vigente da Acompanhante.
- **Sistema_de_Localidades**: Componente responsável por consultar e cachear estados e cidades a partir da API_IBGE.
- **Biblioteca_de_Componentes**: Conjunto de componentes de UI reutilizáveis (Card, Input, Button, Select, etc.) usados em todas as páginas.
- **Ambiente_de_Execucao**: Configuração de runtime do Privello, incluindo Docker, variáveis de ambiente e dependências externas (PostgreSQL, Cloudflare R2, Mercado Pago).

## Requirements

### Requirement 1: Autenticação Unificada

**User Story:** As a Cliente or already-registered Acompanhante, I want to access my account with email and password, so that I can use the platform with the correct identity.

#### Acceptance Criteria

1. WHEN um Usuario submete um email correspondente a uma conta existente e a senha verifica corretamente contra o hash armazenado, THE Sistema_de_Autenticacao SHALL autenticar o Usuario e iniciar uma sessão associada ao seu tipo (Cliente ou Acompanhante), com prazo de expiração não superior a 30 dias.
2. IF o email informado não estiver cadastrado, THEN THE Sistema_de_Autenticacao SHALL rejeitar a tentativa e retornar uma mensagem genérica de credenciais inválidas, sem revelar se o email existe.
3. IF a senha informada não corresponder ao hash armazenado, THEN THE Sistema_de_Autenticacao SHALL rejeitar a tentativa e retornar uma mensagem genérica de credenciais inválidas.
4. THE Sistema_de_Autenticacao SHALL armazenar senhas exclusivamente como hash gerado por função de hash de senha resistente a força bruta (por exemplo bcrypt, scrypt ou argon2).
5. WHEN um Usuario autenticado solicita logout, THE Sistema_de_Autenticacao SHALL encerrar a sessão e invalidar as credenciais de sessão emitidas, de forma que requisições subsequentes apresentando essas credenciais sejam rejeitadas.
6. WHILE um Usuario possui uma sessão dentro do prazo de expiração e que ainda não foi invalidada por logout, THE Sistema_de_Autenticacao SHALL expor o tipo do Usuario (Cliente ou Acompanhante) para que o restante da plataforma diferencie permissões.
7. IF uma requisição apresentar credenciais de sessão expiradas ou previamente invalidadas, THEN THE Sistema_de_Autenticacao SHALL rejeitar a requisição como não autenticada e exigir novo login.
8. IF um mesmo email acumular 5 ou mais tentativas de login com senha incorreta dentro de uma janela de 15 minutos, THEN THE Sistema_de_Autenticacao SHALL bloquear novas tentativas para esse email durante 15 minutos a partir da última tentativa rejeitada.

### Requirement 2: Cadastro de Cliente

**User Story:** As a visitor interested in consuming content, I want to register as a Cliente by providing minimal data, so that I can access the platform quickly.

#### Acceptance Criteria

1. THE Sistema_de_Cadastro_Cliente SHALL solicitar nome, email, Identificador e senha como dados obrigatórios para criar uma conta de Cliente.
2. WHEN o Cliente submete o formulário com todos os campos preenchidos e válidos, THE Sistema_de_Cadastro_Cliente SHALL persistir a conta e marcar seu tipo como Cliente.
3. IF o email informado já estiver associado a um Usuario existente, THEN THE Sistema_de_Cadastro_Cliente SHALL rejeitar o cadastro sem persistir a conta e exibir mensagem indicando que o email já está em uso.
4. IF o Identificador informado, comparado em caixa baixa, já estiver em uso por qualquer Usuario, THEN THE Sistema_de_Cadastro_Cliente SHALL rejeitar o cadastro sem persistir a conta e exibir mensagem indicando que o Identificador já está em uso.
5. THE Sistema_de_Cadastro_Cliente SHALL validar que o Identificador contém apenas caracteres alfanuméricos e/ou sublinhado, com comprimento entre 3 e 30 caracteres, e SHALL armazená-lo em caixa baixa.
6. THE Sistema_de_Cadastro_Cliente SHALL validar que o nome tem comprimento entre 2 e 100 caracteres após remoção de espaços nas extremidades.
7. THE Sistema_de_Cadastro_Cliente SHALL validar que o email tem formato válido (parte local, `@` e domínio com ao menos um ponto) e comprimento total entre 5 e 254 caracteres.
8. THE Sistema_de_Cadastro_Cliente SHALL exigir senha com comprimento entre 8 e 128 caracteres.
9. IF qualquer campo obrigatório estiver ausente ou não satisfizer suas regras de validação, THEN THE Sistema_de_Cadastro_Cliente SHALL rejeitar o cadastro sem persistir a conta e exibir mensagem indicando o campo inválido.
10. WHEN o cadastro de Cliente é concluído com sucesso, THE Sistema_de_Cadastro_Cliente SHALL delegar ao Sistema_de_Autenticacao o início de uma sessão para o Cliente recém-criado.
11. THE Sistema_de_Cadastro_Cliente SHALL aceitar uma Foto_de_Perfil **opcional** no momento do cadastro, com as mesmas regras de formato e tamanho aplicadas pelo Sistema_de_Onboarding (JPEG, PNG ou WEBP, ≤ 10 MB), e SHALL persistir a conta de Cliente normalmente quando nenhuma foto for enviada.
12. WHEN uma Foto_de_Perfil válida é enviada junto ao cadastro de Cliente, THE Sistema_de_Cadastro_Cliente SHALL persistir a foto em uma única operação atômica com a conta, de forma que falha em qualquer parte da persistência reverta todo o cadastro (incluindo o arquivo carregado em estado temporário).

### Requirement 3: Onboarding de Acompanhante em Etapas

**User Story:** As an Acompanhante interested in publishing my profile, I want to go through a guided multi-step registration, so that I can provide my data without being overwhelmed on a single screen.

#### Acceptance Criteria

1. THE Sistema_de_Onboarding SHALL coletar, ao longo das etapas, os seguintes dados obrigatórios da Acompanhante: nome, email, Identificador, senha, número de telefone, estado de atendimento, cidade de atendimento, descrição e Foto_de_Perfil.
2. THE Sistema_de_Onboarding SHALL apresentar os campos em múltiplas etapas distintas, permitindo navegação para a etapa anterior sem perder dados já preenchidos durante a sessão de onboarding em andamento.
3. WHILE o Onboarding_Acompanhante não tiver sido concluído com sucesso, THE Sistema_de_Onboarding SHALL manter os dados parciais apenas em estado temporário vinculado à sessão de onboarding em andamento, descartando esse estado após 60 minutos de inatividade ou ao final da sessão.
4. IF a Acompanhante cancelar explicitamente o fluxo, fechar a aplicação ou permanecer 60 minutos sem interação durante o Onboarding_Acompanhante, THEN THE Sistema_de_Onboarding SHALL descartar todos os dados parciais sem criar conta, sem reservar Identificador e sem armazenar Foto_de_Perfil de forma permanente.
5. WHEN a Acompanhante conclui a última etapa do Onboarding_Acompanhante com todos os dados obrigatórios válidos, THE Sistema_de_Onboarding SHALL persistir a conta de Acompanhante e a Foto_de_Perfil em uma única operação atômica, de forma que falha em qualquer parte da persistência reverta todo o cadastro.
6. IF qualquer parte da persistência atômica do Onboarding_Acompanhante falhar, THEN THE Sistema_de_Onboarding SHALL reverter todos os dados já gravados (incluindo arquivos de mídia), exibir mensagem de erro à Acompanhante e permitir nova tentativa sem deixar conta parcial no sistema.
7. THE Sistema_de_Onboarding SHALL aplicar as mesmas regras do Requirement 2 para email, Identificador e senha (unicidade, formato e comprimento mínimo).
8. THE Sistema_de_Onboarding SHALL validar o número de telefone como um número brasileiro com DDD, contendo entre 10 e 11 dígitos numéricos após remoção dos caracteres de máscara (espaços, parênteses, hífens e o sinal de mais).
9. THE Sistema_de_Onboarding SHALL permitir que a descrição tenha entre 1 e 1000 caracteres.
10. THE Sistema_de_Onboarding SHALL aceitar como Foto_de_Perfil arquivos de imagem nos formatos JPEG, PNG ou WEBP, com tamanho máximo de 10 MB.
11. WHEN o Onboarding_Acompanhante é persistido com sucesso, THE Sistema_de_Onboarding SHALL encaminhar a Acompanhante para a Selecao_de_Plano antes de qualquer outra área autenticada.
12. IF a Acompanhante tentar avançar de uma etapa do Onboarding_Acompanhante com qualquer campo obrigatório dessa etapa ausente ou inválido, THEN THE Sistema_de_Onboarding SHALL bloquear o avanço e exibir mensagem indicando os campos pendentes ou inválidos.

### Requirement 4: Localidades Brasileiras via IBGE

**User Story:** As an Acompanhante, I want to select my service state and city from official lists, so that I avoid typing errors and standardize the search.

#### Acceptance Criteria

1. WHEN a Acompanhante chega à etapa de localidade no Onboarding_Acompanhante, THE Sistema_de_Localidades SHALL apresentar a lista das 27 unidades federativas do Brasil obtida da API_IBGE ou da cache local, com tempo total de carregamento não superior a 5 segundos.
2. WHEN a Acompanhante seleciona um estado, THE Sistema_de_Localidades SHALL apresentar a lista de cidades daquele estado obtida da API_IBGE ou da cache local, com tempo total de carregamento não superior a 5 segundos.
3. THE Sistema_de_Onboarding SHALL aceitar como estado e cidade de atendimento somente valores presentes nas listas oficiais retornadas pelo Sistema_de_Localidades para o estado selecionado, validando essa restrição no servidor antes da persistência atômica do Onboarding_Acompanhante.
4. IF a API_IBGE não responder em até 5 segundos ou retornar erro, THEN THE Sistema_de_Localidades SHALL utilizar dados da cache local quando disponíveis e válidos, ou, quando não houver cache válido, retornar ao Sistema_de_Onboarding uma indicação explícita de falha de carregamento que preserve os dados já preenchidos pela Acompanhante e permita até 3 novas tentativas manuais sem reiniciar o Onboarding_Acompanhante.
5. THE Sistema_de_Localidades SHALL armazenar em cache local os resultados da API_IBGE com tempo de expiração mínimo de 24 horas e máximo de 7 dias, e SHALL servir os dados a partir dessa cache em vez de chamar a API_IBGE sempre que houver registro válido para a consulta solicitada.

### Requirement 5: Seleção de Plano

**User Story:** As a newly-registered Acompanhante, I want to choose between a Plano_Basico and a Plano_Premium, so that I can define the limits and benefits of my account.

#### Acceptance Criteria

1. WHEN a Acompanhante conclui o Onboarding_Acompanhante, THE Sistema_de_Planos SHALL apresentar a Selecao_de_Plano com as opções Plano_Basico e Plano_Premium.
2. THE Sistema_de_Planos SHALL descrever o Plano_Basico como permitindo até 10 mídias adicionais à Foto_de_Perfil e sem prioridade em buscas.
3. THE Sistema_de_Planos SHALL descrever o Plano_Premium como permitindo até 50 mídias adicionais à Foto_de_Perfil, com publicação de Stories, Áudio_de_Apresentação ("Ouça minha voz") e prioridade em buscas.
4. WHEN a Acompanhante confirma a seleção de um valor que corresponda exatamente a Plano_Basico ou a Plano_Premium, THE Sistema_de_Planos SHALL registrar o Plano escolhido como Plano vigente da Acompanhante.
5. WHILE a Acompanhante não tiver um Plano vigente registrado, THE Sistema_de_Planos SHALL bloquear o acesso às áreas autenticadas exclusivas de Acompanhante e redirecioná-la à Selecao_de_Plano.
6. THE Sistema_de_Planos SHALL expor o Plano vigente da Acompanhante para outros componentes da plataforma, de forma que limites de mídia, prioridade em buscas, disponibilidade de Stories e disponibilidade do Áudio_de_Apresentação possam ser aplicados onde necessário.
7. THE Sistema_de_Planos SHALL registrar a Foto_de_Perfil fora da contagem de mídias de qualquer Plano.
8. IF a seleção submetida não corresponder a Plano_Basico nem a Plano_Premium, THEN THE Sistema_de_Planos SHALL rejeitar a seleção, manter a Acompanhante sem Plano vigente e exibir mensagem indicando que a opção é inválida.
9. IF o registro do Plano vigente falhar por erro de persistência, THEN THE Sistema_de_Planos SHALL manter a Acompanhante sem Plano vigente, exibir mensagem indicando a falha e permitir nova tentativa na Selecao_de_Plano sem exigir refazer o Onboarding_Acompanhante.
10. WHEN o Plano vigente da Acompanhante é registrado com sucesso, THE Sistema_de_Planos SHALL encaminhá-la para a área autenticada exclusiva de Acompanhante.

### Requirement 6: Biblioteca de Componentes Reutilizáveis

**User Story:** As a development team, we want a shared UI component library, so that we maintain visual consistency and accelerate the creation of new pages.

#### Acceptance Criteria

1. THE Biblioteca_de_Componentes SHALL fornecer, no mínimo, componentes Card, Input, Button e Select disponíveis para uso por todas as páginas da Privello.
2. WHEN uma página da Privello renderiza um elemento equivalente a Card, Input, Button ou Select, THE página SHALL consumir o componente correspondente da Biblioteca_de_Componentes em vez de implementar uma variante local do mesmo elemento.
3. THE Biblioteca_de_Componentes SHALL expor cada componente com uma API de propriedades tipada e acompanhada de descrição textual legível para cada propriedade pública.
4. THE Biblioteca_de_Componentes SHALL suportar estado desabilitado em Card, Input, Button e Select, estado de carregamento em Button, e estado de erro em Input e Select.
5. THE Biblioteca_de_Componentes SHALL impedir que componentes exponham propriedades cujos nomes ou tipos referenciem entidades de domínio específicas das páginas que os consomem (por exemplo, Cliente, Acompanhante, Plano_Basico ou Plano_Premium), permitindo composições como Input dentro de Card sem acoplamento de contexto.
6. THE Biblioteca_de_Componentes SHALL expor definições compartilhadas de cores, tipografia e espaçamento que sejam aplicadas por todos os seus componentes, garantindo consistência visual entre páginas.

### Requirement 7: Ambiente de Execução e Configuração

**User Story:** As a development team, we want to run Privello locally in containers and deploy it to Railway, so that we have parity between environments and segregation of secrets.

#### Acceptance Criteria

1. THE Ambiente_de_Execucao SHALL prover um Dockerfile que constrói uma imagem da aplicação Next.js da Privello em modo de produção, com artefatos pré-construídos e servidor HTTP escutando em uma porta configurável por variável de ambiente.
2. THE Ambiente_de_Execucao SHALL prover um docker-compose para desenvolvimento local que sobe a aplicação e uma instância de PostgreSQL com volume persistente, conectados pelo nome de serviço.
3. THE Ambiente_de_Execucao SHALL expor as configurações de PostgreSQL, Cloudflare R2 e Mercado Pago exclusivamente por variáveis de ambiente, e SHALL excluir os arquivos `.env` e `.env.local` do controle de versão.
4. THE Ambiente_de_Execucao SHALL prover um arquivo `.env.example` listando exatamente o conjunto de variáveis de ambiente necessárias (sem variáveis obrigatórias faltantes e sem variáveis não utilizadas), com valores placeholder não sensíveis.
5. IF uma variável de ambiente obrigatória estiver ausente na inicialização, THEN THE Ambiente_de_Execucao SHALL abortar antes de aceitar requisições HTTP, encerrar com código de saída diferente de zero e exibir mensagem nomeando todas as variáveis ausentes.
6. THE Ambiente_de_Execucao SHALL permitir deploy no Railway usando o mesmo Dockerfile utilizado localmente, sem alterações no código-fonte e diferindo apenas nos valores de variáveis de ambiente.
7. WHERE o Cloudflare R2 for usado para armazenamento de mídias, THE Ambiente_de_Execucao SHALL permitir configurar endpoint, credenciais e bucket por variáveis de ambiente, e SHALL confinar bibliotecas, chamadas e tipos específicos do R2 a um único módulo de armazenamento da plataforma.
8. WHERE o Mercado Pago for usado para pagamentos, THE Ambiente_de_Execucao SHALL permitir configurar credenciais e ambiente (sandbox/produção) por variáveis de ambiente, e SHALL confinar bibliotecas, chamadas e tipos específicos do Mercado Pago a um único módulo de pagamentos da plataforma.
