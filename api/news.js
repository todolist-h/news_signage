import fetch from 'node-fetch';
import xml2js from 'xml2js';
import cheerio from 'cheerio';

const RSS_URL = 'https://www3.nhk.or.jp/rss/news/cat0.xml'; 

export default async function handler(req, res) {
  try {
    const response = await fetch(RSS_URL);
    const xml = await response.text();
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
    const items = parsed.rss.channel.item;

    const newsData = await Promise.all(items.slice(0, 10).map(async (item) => {
      // 画像取得ロジック：RSSのサムネイル → なければ記事のOGP画像
      let imageUrl = item['media:thumbnail']?.$.url || null;
      if (!imageUrl) {
        try {
          const pageRes = await fetch(item.link);
          const html = await pageRes.text();
          const $ = cheerio.load(html);
          imageUrl = $('meta[property="og:image"]').attr('content');
        } catch (e) { imageUrl = 'https://via.placeholder.com/1920x1080?text=No+Image'; }
      }

      return {
        title: item.title,
        excerpt: item.description.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...',
        image: imageUrl,
        time: new Date(item.pubDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      };
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(newsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
