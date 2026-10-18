-- Seleção revisada: incorporações de canais oficiais do YouTube.
-- Não duplica vídeos existentes nem modifica publicações anteriores.
with creator as (
 select l.created_by from public.novaplay_library l
 join public.novaplay_admins a on a.user_id=l.created_by
 where l.youtube_id is not null order by l.created_at desc,l.id limit 1
), source as (
 select value as item,ordinality as position from jsonb_array_elements($nplay_comedy$[
  {
    "youtube_id": "sgycDtk212Y",
    "title": "Mazzaropi — Jeca e Seu Filho Preto",
    "genre": "Filmes completos · Comédia",
    "description": "Filme completo de comédia disponibilizado pelo canal NetMovies Comédia.\n\nCanal: NetMovies Comédia\n\nFonte: https://www.youtube.com/watch?v=sgycDtk212Y\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 6181
  },
  {
    "youtube_id": "AMRJS1ivRsI",
    "title": "Mazzaropi — O Jeca e a Freira",
    "genre": "Filmes completos · Comédia",
    "description": "Filme completo de comédia disponibilizado pelo canal NetMovies Comédia.\n\nCanal: NetMovies Comédia\n\nFonte: https://www.youtube.com/watch?v=AMRJS1ivRsI\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 5832
  },
  {
    "youtube_id": "f2uiovcTuFc",
    "title": "Mazzaropi — O Vendedor de Linguiça",
    "genre": "Filmes completos · Comédia",
    "description": "Filme completo de comédia disponibilizado pelo canal NetMovies Comédia.\n\nCanal: NetMovies Comédia\n\nFonte: https://www.youtube.com/watch?v=f2uiovcTuFc\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 5662
  },
  {
    "youtube_id": "VDFrQNZaqdI",
    "title": "O Lado Simples da Vida",
    "genre": "Filmes completos · Comédia",
    "description": "Filme completo de comédia disponibilizado pelo canal NetMovies Comédia.\n\nCanal: NetMovies Comédia\n\nFonte: https://www.youtube.com/watch?v=VDFrQNZaqdI\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 5937
  },
  {
    "youtube_id": "1X4U8ctaCso",
    "title": "Mazzaropi — Jeca Tatu",
    "genre": "Filmes completos · Comédia",
    "description": "Filme completo de comédia disponibilizado pelo canal NetMovies Comédia.\n\nCanal: NetMovies Comédia\n\nFonte: https://www.youtube.com/watch?v=1X4U8ctaCso\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 5406
  },
  {
    "youtube_id": "wUvVw-Qhgrc",
    "title": "Afonso Padilha — Desessencial",
    "genre": "Humor",
    "description": "Especial completo de stand-up disponibilizado pelo canal Afonso Padilha.\n\nCanal: Afonso Padilha\n\nFonte: https://www.youtube.com/watch?v=wUvVw-Qhgrc\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 4252
  },
  {
    "youtube_id": "hTEnU3HmFqI",
    "title": "Afonso Padilha — Nada Planejado",
    "genre": "Humor",
    "description": "Especial completo de stand-up disponibilizado pelo canal Afonso Padilha.\n\nCanal: Afonso Padilha\n\nFonte: https://www.youtube.com/watch?v=hTEnU3HmFqI\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 4015
  },
  {
    "youtube_id": "BmQswwdkj_E",
    "title": "Afonso Padilha — Espalhando a Palavra",
    "genre": "Humor",
    "description": "Especial completo de stand-up disponibilizado pelo canal Afonso Padilha.\n\nCanal: Afonso Padilha\n\nFonte: https://www.youtube.com/watch?v=BmQswwdkj_E\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 4580
  },
  {
    "youtube_id": "AsUJxTyOJ-M",
    "title": "Barbixas — Versão Improvável #1",
    "genre": "Humor",
    "description": "Humor de improviso disponibilizado pelo canal Barbixas.\n\nCanal: Barbixas\n\nFonte: https://www.youtube.com/watch?v=AsUJxTyOJ-M\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 275
  },
  {
    "youtube_id": "-eclX5Mju34",
    "title": "Barbixas — Dueto Improvável #1",
    "genre": "Humor",
    "description": "Humor de improviso disponibilizado pelo canal Barbixas.\n\nCanal: Barbixas\n\nFonte: https://www.youtube.com/watch?v=-eclX5Mju34\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 235
  },
  {
    "youtube_id": "LdsKvZVk1Hg",
    "title": "Barbixas — Cenas Improváveis #80",
    "genre": "Humor",
    "description": "Humor de improviso disponibilizado pelo canal Barbixas.\n\nCanal: Barbixas\n\nFonte: https://www.youtube.com/watch?v=LdsKvZVk1Hg\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 402
  },
  {
    "youtube_id": "y0zB2UhbDi0",
    "title": "Barbixas — Cenas Improváveis #98",
    "genre": "Humor",
    "description": "Humor de improviso disponibilizado pelo canal Barbixas.\n\nCanal: Barbixas\n\nFonte: https://www.youtube.com/watch?v=y0zB2UhbDi0\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 408
  },
  {
    "youtube_id": "Ag0-vKzRREg",
    "title": "Porta dos Fundos — Bloco dos Fundos",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=Ag0-vKzRREg\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 686
  },
  {
    "youtube_id": "_BR3Xf9NWEw",
    "title": "Porta dos Fundos — Comerciais Não Intrusivos",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=_BR3Xf9NWEw\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 924
  },
  {
    "youtube_id": "MyGUeVwayd4",
    "title": "Porta dos Fundos — Amigos do Peito",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=MyGUeVwayd4\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 879
  },
  {
    "youtube_id": "KbFBymE7zhA",
    "title": "Porta dos Fundos — Vai se Tratar",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=KbFBymE7zhA\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 773
  },
  {
    "youtube_id": "jawjt3e9v-w",
    "title": "Porta dos Fundos — Macla Tenório por Trás da Porta",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=jawjt3e9v-w\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 693
  },
  {
    "youtube_id": "AgPurzPKrqk",
    "title": "Porta dos Fundos — Referências",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=AgPurzPKrqk\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 142
  },
  {
    "youtube_id": "Yf6HAUrOkt0",
    "title": "Porta dos Fundos — Nath Cruz por Trás da Porta",
    "genre": "Humor",
    "description": "Vídeo de humor disponibilizado pelo canal Porta dos Fundos.\n\nCanal: Porta dos Fundos\n\nFonte: https://www.youtube.com/watch?v=Yf6HAUrOkt0\n\nReprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal.",
    "duration_seconds": 457
  }
]$nplay_comedy$::jsonb) with ordinality
), inserted as (
 insert into public.novaplay_library
  (youtube_id,title,kind,genre,description,duration_seconds,created_by,is_published,rights_reviewed,rights_reviewed_at,created_at)
 select item->>'youtube_id',item->>'title','movie',item->>'genre',item->>'description',
  (item->>'duration_seconds')::integer,creator.created_by,true,true,now(),now()-position*interval '1 millisecond'
 from source cross join creator
 where not exists (select 1 from public.novaplay_library old where old.youtube_id=source.item->>'youtube_id')
 returning youtube_id,genre
)
select count(*) as inserted_count,count(*) filter(where genre='Filmes completos · Comédia') as films_added,
 count(*) filter(where genre='Humor') as humor_added from inserted;
