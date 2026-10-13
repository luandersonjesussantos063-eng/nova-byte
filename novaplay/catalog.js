/* Catálogo NovaPlay V 0.37.0 • conteúdos clássicos e TV aberta gratuita */
window.NovaPlayCatalog={
  "version": "0.37.0",
  "channels": [
      {
          "id": "camara",
          "title": "TV Câmara",
          "kind": "tv",
          "category": "Legislativo • Brasil",
          "description": "Transmissão pública da Câmara dos Deputados pelo sinal HLS da emissora.",
          "year": null,
          "cover": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20C%C3%A2mara%20logo%202018.png",
          "backdrop": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20C%C3%A2mara%20logo%202018.png",
          "mode": "hls",
          "src": "https://stream3.camara.gov.br/tv1/manifest.m3u8",
          "sourcePage": "https://www.camara.leg.br/tv/como-sintonizar",
          "brandColor": "#142d56",
          "live": true
      },
      {
          "id": "brasil",
          "title": "TV Brasil",
          "kind": "tv",
          "category": "TV pública • Brasil",
          "description": "Programação gratuita da TV Brasil / EBC, transmitida a partir do sinal da emissora.",
          "year": null,
          "cover": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Brasil%20logo%202023.svg",
          "backdrop": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Brasil%20logo%202023.svg",
          "mode": "hls",
          "src": "https://tvbrasil-stream.ebc.com.br/index.m3u8",
          "sourcePage": "https://aovivo.ebc.com.br/",
          "brandColor": "#174a6c",
          "live": true
      },
      {
          "id": "cultura",
          "title": "TV Cultura",
          "kind": "tv",
          "category": "Cultura • Educação",
          "description": "Conteúdos culturais e educativos; programação ao vivo da TV Cultura.",
          "year": null,
          "cover": "https://commons.wikimedia.org/wiki/Special:FilePath/Cultura%20logo%202013.svg",
          "backdrop": "https://commons.wikimedia.org/wiki/Special:FilePath/Cultura%20logo%202013.svg",
          "mode": "hls",
          "src": "https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8",
          "sourcePage": "https://culturaplay.tvcultura.com.br/channels/14",
          "brandColor": "#27355c",
          "live": true
      },
      {
          "id": "senado",
          "title": "TV Senado",
          "kind": "tv",
          "category": "Legislativo • Brasil",
          "description": "Acompanhe gratuitamente a programação da TV Senado pelo site oficial do Senado Federal.",
          "mode": "external",
          "sourcePage": "https://www12.senado.leg.br/tv/programas/ao-vivo/2026",
          "cover": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Senado%20(Brasil)%20logo.svg",
          "backdrop": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Senado%20(Brasil)%20logo.svg",
          "brandColor": "#16384f",
          "externalLabel": "SITE OFICIAL",
          "live": true
      },
      {
          "id": "justica",
          "title": "TV Justiça",
          "kind": "tv",
          "category": "Justiça • Brasil",
          "description": "Acompanhe a programação da TV Justiça pelo portal oficial da emissora.",
          "mode": "external",
          "sourcePage": "https://radioetvjustica.jus.br/",
          "cover": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Justi%C3%A7a%20logo.png",
          "backdrop": "https://commons.wikimedia.org/wiki/Special:FilePath/TV%20Justi%C3%A7a%20logo.png",
          "brandColor": "#172d51",
          "externalLabel": "SITE OFICIAL",
          "live": true
      },
      {
          "id": "assembleia-mt",
          "title": "TV Assembleia MT",
          "kind": "tv",
          "category": "Mato Grosso • Legislativo",
          "description": "Programação da TV Assembleia Legislativa de Mato Grosso (TVAL), disponível no portal da ALMT.",
          "mode": "external",
          "sourcePage": "https://www.al.mt.gov.br/institucional/tv",
          "cover": "https://www.saganews.com.br/img/ALMT.png",
          "backdrop": "https://www.saganews.com.br/img/ALMT.png",
          "brandColor": "#30462b",
          "customLabel": "TVAL • MATO GROSSO",
          "externalLabel": "SITE OFICIAL",
          "live": true
      },
      {
          "id": "plutotv",
          "title": "Pluto TV — canais grátis",
          "kind": "tv",
          "category": "Filmes • Séries • Infantil • Notícias",
          "description": "Explore os canais gratuitos e a programação sob demanda na plataforma oficial da Pluto TV. O conteúdo é reproduzido no site da Pluto TV, não dentro da NovaPlay.",
          "mode": "external",
          "sourcePage": "https://pluto.tv/br/live-tv",
          "cover": "https://commons.wikimedia.org/wiki/Special:FilePath/Pluto%20TV%20logo%202024.svg",
          "backdrop": "https://commons.wikimedia.org/wiki/Special:FilePath/Pluto%20TV%20logo%202024.svg",
          "brandColor": "#2a2350",
          "externalLabel": "ABRIR PLUTO TV",
          "live": false
      }
  ],

  "films": [
    {
      "id": "lua",
      "title": "Viagem à Lua",
      "kind": "film",
      "category": "Ficção científica • Mudo",
      "description": "Um foguete viaja até a Lua no clássico de Georges Méliès. Versão histórica sem dublagem.",
      "year": 1902,
      "duration": "13 min",
      "cover": "./assets/posters/lua.svg",
      "backdrop": "./assets/posters/lua.svg",
      "mode": "video",
      "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Le%20Voyage%20dans%20la%20Lune%20(1902).webm",
      "sourcePage": "https://commons.wikimedia.org/wiki/File:Le_Voyage_dans_la_Lune_(1902).webm",
      "live": false
    },
    {
      "id": "nosferatu",
      "title": "Nosferatu",
      "kind": "film",
      "category": "Terror • Mudo",
      "description": "O vampiro Conde Orlok chega à cidade neste clássico do expressionismo alemão. Versão histórica.",
      "year": 1922,
      "duration": "61 min",
      "cover": "./assets/posters/nosferatu.svg",
      "backdrop": "./assets/posters/nosferatu.svg",
      "mode": "video",
      "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Nosferatu%20le%20vampire-Film%20Murnau%201922.webm",
      "sourcePage": "https://commons.wikimedia.org/wiki/File:Nosferatu_le_vampire-Film_Murnau_1922.webm",
      "live": false
    },
    {
      "id": "caligari",
      "title": "O Gabinete do Dr. Caligari",
      "kind": "film",
      "category": "Suspense • Mudo",
      "description": "Um hipnotizador misterioso em um dos marcos do cinema expressionista.",
      "year": 1920,
      "duration": "51 min",
      "cover": "./assets/posters/caligari.svg",
      "backdrop": "./assets/posters/caligari.svg",
      "mode": "video",
      "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/The%20Cabinet%20of%20Dr.%20Caligari.webm",
      "sourcePage": "https://commons.wikimedia.org/wiki/File:The_Cabinet_of_Dr._Caligari.webm",
      "live": false
    },
    {
      "id": "lostworld",
      "title": "O Mundo Perdido",
      "kind": "film",
      "category": "Aventura • Dinossauros",
      "description": "Exploradores encontram criaturas pré-históricas nesta adaptação clássica de Arthur Conan Doyle.",
      "year": 1925,
      "duration": "68 min",
      "cover": "./assets/posters/lostworld.svg",
      "backdrop": "./assets/backdrops/lostworld-hero.svg",
      "mode": "video",
      "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/The%20Lost%20World%20(1925)%20(640x480).webm",
      "sourcePage": "https://commons.wikimedia.org/wiki/File:The_Lost_World_(1925)_(640x480).webm",
      "live": false
    }
  ],
  "series": [
    {
      "id": "pauline",
      "title": "Os Perigos de Pauline",
      "kind": "series",
      "category": "Aventura • Seriado mudo",
      "description": "Uma série clássica de aventura protagonizada por Pearl White. Acompanhe as escapadas de Pauline capítulo por capítulo.",
      "year": 1914,
      "cover": "./assets/posters/pauline.svg",
      "backdrop": "./assets/posters/pauline.svg",
      "episodes": [
        {
          "id": "pauline-1",
          "label": "Capítulo 1",
          "title": "Pauline — Episódio 1",
          "duration": "29 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Perils%20of%20Pauline%20Episode%201%20(1914).webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:Perils_of_Pauline_Episode_1_(1914).webm"
        },
        {
          "id": "pauline-2",
          "label": "Capítulo 2",
          "title": "Pauline — Episódio 2",
          "duration": "25 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.2%20Pearl%20White%202.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.2_Pearl_White_2.webm"
        },
        {
          "id": "pauline-3",
          "label": "Capítulo 3",
          "title": "Pauline — Episódio 3",
          "duration": "20 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.3%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.3_Pearl_White.webm"
        },
        {
          "id": "pauline-4",
          "label": "Capítulo 4",
          "title": "Pauline — Episódio 4",
          "duration": "9 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.4%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.4_Pearl_White.webm"
        },
        {
          "id": "pauline-5",
          "label": "Capítulo 5",
          "title": "Pauline — Episódio 5",
          "duration": "14 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.5%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.5_Pearl_White.webm"
        },
        {
          "id": "pauline-6",
          "label": "Capítulo 6",
          "title": "Pauline — Episódio 6",
          "duration": "15 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.6%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.6_Pearl_White.webm"
        },
        {
          "id": "pauline-7",
          "label": "Capítulo 7",
          "title": "Pauline — Episódio 7",
          "duration": "19 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.7%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.7_Pearl_White.webm"
        },
        {
          "id": "pauline-8",
          "label": "Capítulo 8",
          "title": "Pauline — Episódio 8",
          "duration": "18 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.8%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.8_Pearl_White.webm"
        },
        {
          "id": "pauline-9",
          "label": "Capítulo 9",
          "title": "Pauline — Episódio 9",
          "duration": "15 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/THE%20PERILS%20OF%20PAULINE%20(1914)%20-%20ch.9%20Pearl%20White.webm",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:THE_PERILS_OF_PAULINE_(1914)_-_ch.9_Pearl_White.webm"
        }
      ],
      "live": false
    },
    {
      "id": "phantom",
      "title": "O Império Fantasma",
      "kind": "series",
      "category": "Faroeste • Ficção científica",
      "description": "Aventura seriada de 1935 que mistura elementos de faroeste com ficção científica. Primeiro capítulo disponível.",
      "year": 1935,
      "cover": "./assets/posters/phantom.svg",
      "backdrop": "./assets/posters/phantom.svg",
      "episodes": [
        {
          "id": "phantom1",
          "label": "Capítulo 1",
          "title": "O Império Fantasma — Ep. 1",
          "duration": "30 min",
          "mode": "video",
          "src": "https://commons.wikimedia.org/wiki/Special:Redirect/file/The%20Phantom%20Empire%2C%20Chapter%201.ogv",
          "sourcePage": "https://commons.wikimedia.org/wiki/File:The_Phantom_Empire%2C_Chapter_1.ogv"
        }
      ],
      "live": false
    }
  ]
};
