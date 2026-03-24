async function updateSchoolInfo() {
            try {
                const res = await fetch(INFO_URL + '?t=' + Date.now());
                if (!res.ok) return;
                const rawText = await res.text();
                const lines = rawText.split(/\r?\n/);
                
                // 現在の日付と言語設定に応じた曜日を取得
                const now = new Date();
                const todayStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
                
                // 「3月24日（火）」のような形式を作成
                const month = now.getMonth() + 1;
                const date = now.getDate();
                const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
                const dateLabel = `【${month}月${date}日（${dayOfWeek}）のニュース】`;

                let fixedText = "", todayText = "";
                lines.forEach(line => {
                    const t = line.trim();
                    if (!t) return;

                    if (t.startsWith("[固定]")) {
                        fixedText = t.replace("[固定]", "【お知らせ】");
                    } else {
                        // info.txt内の [2026/03/24] 形式をチェック
                        const m = t.match(/^\[(\d{4}\/\d{2}\/\d{2})\]/);
                        if (m && m[1] === todayStr) {
                            // 一致したら、動的に作った日付ラベルに置き換え
                            todayText = t.replace(m[0], dateLabel);
                        }
                    }
                });

                // テキストの合成（本日分がある場合は先に、ない場合は固定のみ）
                const contentEl = document.getElementById('ticker-content');
                if (todayText) {
                    contentEl.textContent = `${todayText}　／　${fixedText}`;
                } else {
                    contentEl.textContent = fixedText || "【連絡】現在、特別な連絡事項はありません。";
                }
            } catch (e) {
                console.error("校内ニュースの読み込み失敗", e);
            }
        }
