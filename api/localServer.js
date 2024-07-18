const express = require("express");
const osc = require("node-osc");
const WebSocket = require("ws");
const path = require("path");
const { OpenAI } = require("openai");
const ip = require("ip");
require("dotenv").config();

const app = express();
const PORT = 3000;
const serverIP = ip.address();

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on http://${serverIP}:${PORT}`);
});

const wss = new WebSocket.Server({ server });

const oscServer = new osc.Server(10000, "0.0.0.0", () => {
  console.log("OSC server listening on port 10000");
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateMessageFromKeyword(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      max_tokens: 100,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating message from OpenAI:", error);
    return null;
  }
}

const ROLE = "あなたはネットの匿名掲示板のヘビーユーザーです。";

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getPromptForOSCMessage(messageType) {
  const ages = ["10代", "20代"];
  const genders = ["男性", "女性"];

  const age = getRandomElement(ages);
  const gender = getRandomElement(genders);

  const basePrompt = `${ROLE}${age}${gender}のあなたは、`;

  switch (messageType) {
    case 0:
      return `${basePrompt}${getRandomElement([
        "仕事をさぼる人に対する呆れを表現してください。",
        "やるべきことをやらないくて責任感のない人への批判を述べてください。",
        "サボり癖のある人への呆れたコメントを考えてください。",
      ])}一文で答えてください。`;
    case 1:
      return `${basePrompt}${getRandomElement([
        "世の中の秩序を守る人への感謝を表現してください。",
        "社会の秩序維持に貢献する人を褒めてください。",
        "秩序ある社会の利点について触れてください。",
      ])}軽い雰囲気で、一文で答えてください。`;
    case 2:
      return `${basePrompt}${getRandomElement([
        "ルール違反を見過ごす人への怒りを表現してください。",
        "秩序を乱す行為を容認する人を非難してください。",
        "社会のルールを無視する人とその擁護者を批判してください。",
        "規則違反を黙認する人の問題点を指摘してください。",
        "法令順守の重要性を無視する人への不満を述べてください。",
      ])}激しい口調で、一文で答えてください。`;
    case 3:
      return `${basePrompt}${getRandomElement([
        "簡単な仕事もできない人をバカにするコメントを書いてください。",
        "基本的なタスクでつまずく人への皮肉を込めたアドバイスをしてください。",
        "単純な作業で失敗する人への呆れを表現してください。",
        "基礎的なスキルが欠如している人への辛辣な批評を述べてください。",
      ])}一文で答えてください。`;
    case 4:
      return `${basePrompt}${getRandomElement([
        "誰かの成功を過剰に褒め称えてください。",
        "ある人の成果を誇張して讃えてください。",
        "ある人の達成を神格化するようなコメントを書いてください。",
      ])}自分の責務を全うした人に対して軽薄な言葉で、一文で答えてください。`;
  }
}

oscServer.on("message", async (msg) => {
  console.log("Received OSC message:", msg);

  const comment = await generateCommentFromOSC(msg);
  if (comment) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        console.log("Sending comment to WebSocket client:", comment);
        client.send(JSON.stringify({ type: "comment", comment }));
      }
    });
  }
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, "public")));

// ルートURLへのアクセスで index.html を提供
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WebSocket接続の管理
wss.on("connection", (ws) => {
  console.log("WebSocket client connected");

  ws.on("message", (message) => {
    console.log("Received message from client:", message);
    // クライアントからのメッセージを処理し、必要に応じて他のクライアントにブロードキャスト
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

console.log("Server started. Waiting for connections...");

// OSCメッセージを元にコメントを生成する関数
async function generateCommentFromOSC(msg) {
  if (msg.length > 1 && typeof msg[1] === "number") {
    const messageType = msg[1];
    const prompt = getPromptForOSCMessage(messageType);
    const generatedMessage = await generateMessageFromKeyword(prompt);
    if (generatedMessage) {
      console.log("Generated message from OpenAI:", generatedMessage);
      return `${generatedMessage}`;
    }
  }
  console.log("Failed to generate comment");
  return null;
}
