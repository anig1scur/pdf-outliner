import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from '$env/dynamic/private';

const LAYOUT_CONFIG = {
  colWidth: 200,   
  rowHeight: 140,  
  padding: 60,
  // 移除 clusterGap，因为不再按行分组
};

// 升级 Prompt：更严厉的“打散”指令
const SYSTEM_PROMPT = `
Role: You are an expert Detective connecting clues.
Task: Create a "Conspiracy Wall" style knowledge graph from the ToC.

**CRITICAL RULES:**
1. **EXPLODE THE HIERARCHY**: 
   - DO NOT summarize a whole Part/Chapter into one node.
   - You MUST extract specific sub-concepts (Level 2/Level 3 items).
   - **TARGET: Generate at least 12-20 nodes.** If the input is short, break it down further.
   
2. **Nodes**:
   - Label: Keep it short (2-4 words).
   - Cluster: Group them by theme (e.g., "The Crime", "The Motive", "The Evidence").

3. **Edges**:
   - Connect everything. No orphans.
   - Use 'type': 'CAUSES' | 'REQUIRES' | 'CONTRASTS' | 'LINKS'.

Output JSON:
{
  "nodes": [ { "id": "string", "label": "string", "cluster": "string" } ], 
  "edges": [ { "source": "id", "target": "id", "type": "string", "label": "string" } ]
}
`;

export async function POST({request}) {
  try {
    const { tocItems, apiKey } = await request.json();

    if (!tocItems || !Array.isArray(tocItems)) {
      return new Response(JSON.stringify({ error: 'Invalid tocItems' }), { status: 400 });
    }

    const googleApiKey = apiKey || env.GOOGLE_API_KEY;
    const tocText = tocItems.map((item) => `${item.id}: ${item.title}`).join('\n');
    const fullPrompt = `${SYSTEM_PROMPT}\n\nToC to Analyze:\n${tocText}`;

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { responseMimeType: "application/json" } 
    });
    
    const responseText = result.response.text();
    const cleanedJson = responseText.replace(/```json|```/g, '').trim();
    let aiData;
    
    try {
      aiData = JSON.parse(cleanedJson);
    } catch (e) {
      throw new Error("AI returned invalid JSON structure");
    }

    // --- 数据恢复逻辑 ---
    // 如果 AI 返回的节点太少 (< 5)，强制把原始 ToC 的前 15 个项加进去
    let finalGraphNodes = aiData.nodes || [];
    
    if (finalGraphNodes.length < 5) {
      const fallbackNodes = tocItems.slice(0, 15).map(item => ({
        id: String(item.id),
        label: item.title,
        cluster: 'Evidence',
        page: item.page
      }));
      // 合并并去重
      const existingIds = new Set(finalGraphNodes.map(n => String(n.id)));
      fallbackNodes.forEach(n => {
        if (!existingIds.has(n.id)) finalGraphNodes.push(n);
      });
    }

    // 补全页码 (Data Merging)
    finalGraphNodes = finalGraphNodes.map((aiNode: any) => {
      let match = tocItems.find((t) => String(t.id) === String(aiNode.id));
      if (!match && aiNode.label) {
        match = tocItems.find((t) => t.title.toLowerCase().includes(aiNode.label.toLowerCase()));
      }
      return {
        id: aiNode.id,
        title: aiNode.label || aiNode.id,
        page: match ? match.page : null,
        cluster: aiNode.cluster || 'default',
        x: 0, y: 0 
      };
    });

    // ==========================================
    // 核心修复：Unified Grid Layout (全局网格布局)
    // ==========================================
    
    // 1. 打乱数组顺序 (Shuffle)，让不同 Cluster 的节点混合在一起，看起来更像“乱序的线索墙”
    // 这样相同颜色的便利贴不会死板地聚在一起，而是散落在墙上
    for (let i = finalGraphNodes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalGraphNodes[i], finalGraphNodes[j]] = [finalGraphNodes[j], finalGraphNodes[i]];
    }

    const totalCount = finalGraphNodes.length;
    // 强制计算一个近似正方形的网格列数
    // 例如 12个节点 -> sqrt(12)≈3.4 -> 4列 -> 3行
    const TARGET_COLS = Math.ceil(Math.sqrt(totalCount)); 
    
    finalGraphNodes.forEach((node: any, idx: number) => {
      const col = idx % TARGET_COLS;
      const row = Math.floor(idx / TARGET_COLS);
      
      // 基础网格坐标
      let gridX = LAYOUT_CONFIG.padding + col * LAYOUT_CONFIG.colWidth;
      let gridY = LAYOUT_CONFIG.padding + row * LAYOUT_CONFIG.rowHeight;

      // 增加显著的随机偏移 (Jitter)，打破死板的网格感
      // offset 范围在 -30 到 +30 之间
      const randomOffsetX = (Math.random() - 0.5) * 60; 
      const randomOffsetY = (Math.random() - 0.5) * 60;

      node.x = gridX + randomOffsetX;
      node.y = gridY + randomOffsetY;
    });

    return new Response(JSON.stringify({
      nodes: finalGraphNodes,
      edges: aiData.edges || []
    }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
