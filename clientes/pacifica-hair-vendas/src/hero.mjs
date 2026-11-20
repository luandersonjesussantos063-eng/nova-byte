// Imagens enviadas pelo cliente para o carrossel principal da Pacífica.
export const HERO_INTERVAL_MS = 3000;
export const HERO_SLIDES = Object.freeze([
  {
    src: "/assets/pacifica-far-away.webp",
    alt: "Modelo de campanha segurando perfume Far Away da Avon, sobre fundo rosa",
    tag: "PACÍFICA HAIR / PERFUMARIA",
    title: "Uma fragrância<br>para <em>encantar.</em>",
    description: "Descubra perfumes e fragrâncias para momentos especiais.",
    cta: "Explorar perfumes"
  },
  {
    src: "/assets/pacifica-avon-care.webp",
    alt: "Modelo de campanha segurando hidratante corporal Avon Care, sobre fundo rosa",
    tag: "PACÍFICA HAIR / CUIDADOS PESSOAIS",
    title: "O cuidado que<br>você <em>merece.</em>",
    description: "Mais carinho para o seu dia, da pele ao bem-estar.",
    cta: "Ver cosméticos"
  },
  {
    src: "/assets/pacifica-power-stay.webp",
    alt: "Modelo de campanha segurando batom Power Stay da Avon, sobre fundo rosa",
    tag: "PACÍFICA HAIR / BELEZA",
    title: "Realce a sua<br><em>beleza.</em>",
    description: "Maquiagem e autoestima em uma seleção feita para você.",
    cta: "Conhecer produtos"
  }
]);
export function nextHeroIndex(current,delta=1){
  const count=HERO_SLIDES.length;
  const n=Number.isFinite(Number(current))?Math.trunc(Number(current)):0;
  return ((n+delta)%count+count)%count;
}
