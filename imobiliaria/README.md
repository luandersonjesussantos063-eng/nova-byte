# Morada — protótipo imobiliário Nova Byte

Página independente de demonstração em `/imobiliaria/`, servida pelo GitHub Pages existente da Nova Byte. Não altera a página inicial, domínio, campanhas ou formulários reais.

## Experiência

- Seis imóveis fictícios, compra e aluguel, filtros por bairro, tipo, valor, quartos, código e disponibilidade de tour; ordenação e estado vazio.
- Fichas de imóveis, galeria, impressão e links diretos por hash (`#imovel-101`).
- Favoritos persistidos no navegador e comparação de até três imóveis.
- Casa Jardim com tour panorâmico de sala, cozinha, suíte, área de lazer e banheiro. Arraste, use as setas, zoom e seleção de ambientes. Renderização WebGL com alternativa de projeção esférica em Canvas 2D para navegadores sem GPU.
- Apresentação de 30 segundos e vídeo de lazer de 5 segundos, gerados a partir das imagens conceituais. São montagens com movimentos suaves, não filmagens de um imóvel real. Vídeos locais MP4/H.264, sem áudio e sem dependência de players de terceiros.
- Formulários demonstrativos de visita e captação, mensagem de interesse copiável, esquema de navegação entre ambientes e calculadora Price com taxa mensal escolhida pelo visitante.
- Personalização local de marca, título e preço do anúncio; restauração dos exemplos.

## Limites do protótipo

Marca Morada, anúncios, valores, características, endereços atribuídos aos bairros e imagens são ilustrativos. Os panoramas foram gerados separadamente, portanto não constituem levantamento arquitetônico nem têm continuidade espacial garantida. O tour faz transições entre esses cenários. A planta é um esquema sem escala. Todos esses limites são indicados na experiência.

Sem backend, autenticação de corretor, pagamentos, agenda real, captura de leads ou envio pelo WhatsApp. Os formulários não enviam nem persistem dados pessoais. Favoritos e personalizações usam somente `localStorage` com prefixo `morada-`. O contato da imobiliária e a política de produção devem ser configurados quando existir uma operação real. A página contém `noindex,nofollow` para não divulgar imóveis fictícios como ofertas.

## Arquivos

HTML, CSS e JS independentes, com imagens JPEG locais e vídeos MP4 em `assets/`. As fontes DM Sans e Manrope usam Google Fonts com alternativas do sistema. Nenhuma biblioteca de panorama externa é necessária.

## Mídias e produção

Imagens criadas com a ferramenta integrada de geração de imagens em 01/11/2026. Direção: residência brasileira contemporânea, travertino claro, madeira, vegetação tropical e luz natural. Fachadas, prédio e terreno são fotografias conceituais; sala, cozinha, suíte, lazer e banheiro são panoramas equiretangulares 2:1. As versões `*-flat.jpg` foram reprojetadas para visualização normal. Vídeos usam essas vistas com aproximação suave e identificação de cenário ilustrativo.

## Validação

Validar `node --check imobiliaria/app.js`, `node --check imobiliaria/tour.js` e os testes editoriais existentes após `npm ci --ignore-scripts --no-audit --no-fund`.

Conferir em navegador: filtros, compra/aluguel, favoritos, comparação, detalhes/galeria, tour e troca dos cinco ambientes, vídeo, visita fictícia, calculadora e personalização. A publicação segue a raiz de `main` no Pages existente; aguardar `pages build and deployment` e verificar `/imobiliaria/` no domínio real.
