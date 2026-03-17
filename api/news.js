import fetch from 'node-fetch';
import xml2js from 'xml2js';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml';

export default async function handler(req, res) {
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    
    let items = parsed.rss.channel.item;
    if (!items) return res.status(200).json([]);
    if (!Array.isArray(items)) items = [items];

    const newsData = items.slice(0, 10).map((item) => {
      // 1. ニュースのタイトルから検索キーワードを抽出（最初の10文字程度）
      // タイトルに含まれる固有名詞や一般名詞に反応してUnsplashが画像を選びます
      const keyword = encodeURIComponent(item.title.substring(0, 10));
      
      // 2. UnsplashのSource APIを使用（1920x1080、キーワード指定）
      // 日本語のキーワードでも、ブラウザ側がある程度解釈してくれます
      const finalImageUrl = `https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1920`; 
      // ↑これはデフォルトのニュースっぽい画像。以下でキーワード検索URLを生成します。
      const searchImageUrl = `https://source.unsplash.com/featured/1920x1080?${keyword},news`;

      // 説明文のクリーニング
      const cleanDescription = item.description 
        ? item.description.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().substring(0, 80) + '...'
        : '';

      return {
        title: item.title || 'No Title',
        excerpt: cleanDescription,
        image: searchImageUrl, // キーワードに基づいた画像
        time: item.pubDate 
          ? new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--'
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(newsData);

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: 'Failed' });
  }
}
