// api/news.js テスト用（差し替え）
export default function handler(req, res) {
  const now = new Date().toISOString();
  const sample = [
    { id: "1", title: "テストニュース：動作確認", link:"#", pubDate: now, excerpt: "API が返るか確認するダミー記事です。", image: "/fallback.jpg" },
    { id: "2", title: "テストニュース2", link:"#", pubDate: now, excerpt: "2件目のダミー記事。", image: "/fallback.jpg" }
  ];
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(sample);
}
