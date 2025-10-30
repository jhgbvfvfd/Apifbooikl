
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// --- สี ANSI สำหรับ Console ---
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

// ฟังก์ชันสำหรับ Log แบบสวยงาม
const logger = {
  info: (msg) => console.log(`${colors.cyan}${colors.bright}[ℹ️ ข้อมูล]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}${colors.bright}[✓ สำเร็จ]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}${colors.bright}[⚠️ คำเตือน]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}${colors.bright}[❌ ข้อผิดพลาด]${colors.reset} ${msg}`),
  cmd: (msg) => console.log(`${colors.magenta}${colors.bright}[⚡ คำสั่ง]${colors.reset} ${msg}`),
  event: (msg) => console.log(`${colors.blue}${colors.bright}[📨 เหตุการณ์]${colors.reset} ${msg}`),
  api: (msg) => console.log(`${colors.cyan}[📡 API]${colors.reset} ${msg}`),
  system: (msg) => console.log(`${colors.white}${colors.dim}[🔧 ระบบ]${colors.reset} ${msg}`)
};

// --- ตั้งค่า Token ---
const config = {
  PAGE_ACCESS_TOKEN: 'EAA1Ni2zZAFsYBP5ZBtgvYeQfOk5QaufWKdSK28ZAlUkWW5cBGeGQZBihUvulRAlOF6WQiOmC4MfvDxw6HUc7h2sbGRkcBEbwP1zx0uMT1yYLgXRtpvlLa4iYBZCKTcdB9WmoYDQDAdBWZCfjvtsh4QEhQgVhyEZBOHC8P1YWXw9HMAQpnTgZCbaafODjWUnTnvVaSOl63m05DwZDZD',
  VERIFY_TOKEN: 'ZOZOZOXOXO1DIWJD',
  PORT: process.env.PORT || 3000
};
// --------------------

// ตัวแปรสถิติ
const stats = {
  messagesReceived: 0,
  commandsExecuted: 0,
  errors: 0,
  startTime: new Date(),
  apiCalls: 0
};

if (config.PAGE_ACCESS_TOKEN === 'YOUR_PAGE_ACCESS_TOKEN_HERE' || config.VERIFY_TOKEN === 'YOUR_VERIFY_TOKEN_HERE') {
  logger.warn('กรุณาใส่ PAGE_ACCESS_TOKEN และ VERIFY_TOKEN ในไฟล์ index.js');
}

// โหลดคำสั่ง
const commands = new Map();

// ฟังก์ชันสร้างโฟลเดอร์
function ensureDirectories() {
  logger.system('กำลังตรวจสอบโฟลเดอร์...');
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    logger.success(`สร้างโฟลเดอร์: ${commandsPath}`);
  } else {
    logger.info(`โฟลเดอร์มีอยู่แล้ว: ${commandsPath}`);
  }
}

// โหลดคำสั่งจากโฟลเดอร์ commands
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  console.log(`\n${colors.bgMagenta}${colors.bright} 📂 กำลังโหลดคำสั่ง ${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  
  if (commandFiles.length === 0) {
    logger.warn('ไม่พบไฟล์คำสั่งในโฟลเดอร์ commands/');
    return;
  }
  
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      commands.set(command.name, command);
      logger.success(`โหลดคำสั่ง: ${colors.bright}${command.name}${colors.reset} - ${command.description}`);
    } catch (error) {
      logger.error(`ไม่สามารถโหลดคำสั่ง ${file}: ${error.message}`);
      stats.errors++;
    }
  }
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

// --- API สำหรับส่งข้อความ ---

async function callSendAPI(payload) {
  try {
    stats.apiCalls++;
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${config.PAGE_ACCESS_TOKEN}`,
      payload
    );
    logger.api(`ส่งข้อความไปยัง ${payload.recipient.id} (API Call #${stats.apiCalls})`);
  } catch (error) {
    stats.errors++;
    logger.error(`การส่ง API ล้มเหลว: ${error.response?.data?.error?.message || error.message}`);
  }
}

async function sendText(recipientId, text) {
  await callSendAPI({
    recipient: { id: recipientId },
    message: { text: text },
    messaging_type: 'RESPONSE'
  });
}

async function sendAttachment(recipientId, type, url, isReusable = false) {
  await callSendAPI({
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: type,
        payload: {
          url: url,
          is_reusable: isReusable
        }
      }
    },
    messaging_type: 'RESPONSE'
  });
}

const api = {
  sendText,
  sendAttachment,
  callSendAPI
};

// --- ตัวจัดการข้อความ ---

// จัดการข้อความ (Text)
async function handleMessage(senderId, messageText) {
  stats.messagesReceived++;
  logger.event(`📩 รับข้อความจาก ${colors.bright}${senderId}${colors.reset}: "${colors.cyan}${messageText}${colors.reset}"`);
  
  // ตรวจสอบคำสั่งอัตโนมัติก่อน
  for (const [name, command] of commands) {
    if (command.auto && command.onMessage) {
      try {
        const handled = await command.onMessage(senderId, messageText, api);
        if (handled) {
          logger.cmd(`คำสั่งอัตโนมัติ ${colors.bright}${name}${colors.reset} จัดการข้อความแล้ว`);
          return; // หยุดการประมวลผลคำสั่งอื่น
        }
      } catch (error) {
        stats.errors++;
        logger.error(`ข้อผิดพลาดในคำสั่งอัตโนมัติ ${name}: ${error.message}`);
      }
    }
  }
  
  const args = messageText.trim().split(' ');
  const commandName = args[0].toLowerCase();

  // ค้นหาคำสั่ง
  const command = commands.get(commandName);
  if (command) {
    logger.cmd(`รันคำสั่งจากไฟล์: ${colors.bright}${commandName}${colors.reset}`);
    stats.commandsExecuted++;
    try {
      await command.execute(senderId, args.slice(1), api);
      logger.success(`คำสั่ง ${commandName} ทำงานสำเร็จ`);
    } catch (error) {
      stats.errors++;
      logger.error(`ข้อผิดพลาดในคำสั่ง ${commandName}: ${error.message}`);
      console.log(`${colors.dim}Stack Trace: ${error.stack}${colors.reset}`);
      await api.sendText(senderId, '❌ เกิดข้อผิดพลาดในการรันคำสั่ง');
    }
  } else {
    logger.system(`ไม่พบคำสั่ง "${commandName}" - เงียบ`);
  }
}

// จัดการไฟล์แนบ (Attachments)
async function handleAttachment(senderId, attachments) {
  stats.messagesReceived++;
  const type = attachments[0].type;
  const url = attachments[0].payload?.url || 'ไม่มี URL';
  logger.event(`📎 รับไฟล์แนบจาก ${colors.bright}${senderId}${colors.reset} | ประเภท: ${colors.yellow}${type}${colors.reset}`);
  logger.system(`URL: ${colors.dim}${url}${colors.reset}`);
}

// จัดการ Postback
async function handlePostback(senderId, payload) {
  stats.messagesReceived++;
  logger.event(`🔘 รับ Postback จาก ${colors.bright}${senderId}${colors.reset} | Payload: ${colors.yellow}${payload}${colors.reset}`);

  // จัดการปุ่ม "Get Started"
  if (payload === 'GET_STARTED') {
    logger.cmd('รัน Postback: GET_STARTED');
    stats.commandsExecuted++;
    await api.sendText(senderId, 'สวัสดีครับ! ยินดีต้อนรับสู่บอทของเราครับ 😊\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มใช้งาน');
    return;
  }

  const commandName = payload.toLowerCase();
  const command = commands.get(commandName);
  
  if (command) {
    logger.cmd(`รัน Postback คำสั่ง: ${colors.bright}${commandName}${colors.reset}`);
    stats.commandsExecuted++;
    try {
      await command.execute(senderId, [], api);
      logger.success(`Postback ${commandName} ทำงานสำเร็จ`);
    } catch (error) {
      stats.errors++;
      logger.error(`ข้อผิดพลาดใน Postback ${commandName}: ${error.message}`);
      console.log(`${colors.dim}Stack Trace: ${error.stack}${colors.reset}`);
      await api.sendText(senderId, '❌ เกิดข้อผิดพลาดในการรันคำสั่ง');
    }
  } else {
    logger.warn(`ไม่พบคำสั่งสำหรับ Postback: ${payload}`);
  }
}

// --- API Routes สำหรับจัดการคำสั่ง ---

// ดึงรายการคำสั่งทั้งหมด
app.get('/api/commands', (req, res) => {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  const commandList = commandFiles.map(file => {
    const filePath = path.join(commandsPath, file);
    const code = fs.readFileSync(filePath, 'utf8');
    let cmdInfo = { name: file.replace('.js', ''), description: '', code: code };
    
    try {
      const cmd = require(filePath);
      cmdInfo.name = cmd.name || cmdInfo.name;
      cmdInfo.description = cmd.description || '';
    } catch (e) {
      // ignore
    }
    
    cmdInfo.filename = file;
    return cmdInfo;
  });
  
  res.json(commandList);
});

// ดึงข้อมูลคำสั่งเดียว
app.get('/api/commands/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'commands', req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'ไม่พบไฟล์' });
  }
  
  const code = fs.readFileSync(filePath, 'utf8');
  let cmdInfo = { code: code };
  
  try {
    delete require.cache[require.resolve(filePath)];
    const cmd = require(filePath);
    cmdInfo.name = cmd.name;
    cmdInfo.description = cmd.description;
  } catch (e) {
    cmdInfo.name = req.params.filename.replace('.js', '');
    cmdInfo.description = '';
  }
  
  res.json(cmdInfo);
});

// อัพเดทคำสั่ง
app.put('/api/commands/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'commands', req.params.filename);
  const { code } = req.body;
  
  try {
    fs.writeFileSync(filePath, code, 'utf8');
    delete require.cache[require.resolve(filePath)];
    logger.success(`อัพเดทคำสั่ง: ${req.params.filename}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`ไม่สามารถอัพเดทคำสั่ง: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ลบคำสั่ง
app.delete('/api/commands/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'commands', req.params.filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      const cmdName = req.params.filename.replace('.js', '');
      commands.delete(cmdName);
      delete require.cache[require.resolve(filePath)];
      logger.success(`ลบคำสั่ง: ${req.params.filename}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'ไม่พบไฟล์' });
    }
  } catch (error) {
    logger.error(`ไม่สามารถลบคำสั่ง: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// อัพโหลดไฟล์คำสั่ง
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'commands', req.file.originalname);
    
    fs.renameSync(tempPath, targetPath);
    logger.success(`อัพโหลดคำสั่ง: ${req.file.originalname}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`ไม่สามารถอัพโหลด: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// รีโหลดคำสั่งทั้งหมด
app.post('/api/reload', (req, res) => {
  try {
    // ล้าง cache
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    commandFiles.forEach(file => {
      const filePath = path.join(commandsPath, file);
      delete require.cache[require.resolve(filePath)];
    });
    
    // โหลดใหม่
    commands.clear();
    loadCommands();
    
    logger.success('รีโหลดคำสั่งทั้งหมดสำเร็จ');
    res.json({ success: true, count: commands.size });
  } catch (error) {
    logger.error(`ไม่สามารถรีโหลด: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// --- Webhook ---

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.system(`Webhook Verification: mode=${mode}, token=${token ? '✓' : '✗'}`);

  if (mode && token === config.VERIFY_TOKEN) {
    logger.success('Webhook ยืนยันตัวตนสำเร็จ');
    res.status(200).send(challenge);
  } else {
    logger.error('Webhook ยืนยันตัวตนล้มเหลว - Token ไม่ตรงกัน');
    res.sendStatus(403);
  }
});

// รับข้อความจาก Facebook
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      if (!entry.messaging || !entry.messaging[0]) {
        continue;
      }
      
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;
      const message = webhookEvent.message;

      if (message) {
        if (message.text) {
          await handleMessage(senderId, message.text);
        } else if (message.attachments) {
          await handleAttachment(senderId, message.attachments);
        }
      } else if (webhookEvent.postback) {
        await handlePostback(senderId, webhookEvent.postback.payload);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    logger.warn(`รับ Webhook object ที่ไม่รู้จัก: ${body.object}`);
    res.sendStatus(404);
  }
});

// แสดงสถิติ
function showStats() {
  const uptime = Math.floor((new Date() - stats.startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  console.log(`\n${colors.bgCyan}${colors.bright} 📊 สถิติการทำงานของบอท ${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}⏱️  เวลาทำงาน:${colors.reset} ${hours}ชม ${minutes}นาที ${seconds}วินาที`);
  console.log(`${colors.cyan}📨 ข้อความที่รับ:${colors.reset} ${stats.messagesReceived} ข้อความ`);
  console.log(`${colors.cyan}⚡ คำสั่งที่รัน:${colors.reset} ${stats.commandsExecuted} ครั้ง`);
  console.log(`${colors.cyan}📡 API Calls:${colors.reset} ${stats.apiCalls} ครั้ง`);
  console.log(`${colors.cyan}❌ ข้อผิดพลาด:${colors.reset} ${stats.errors} ครั้ง`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

// แสดงสถิติทุก 5 นาที
setInterval(showStats, 5 * 60 * 1000);

// เริ่มต้นบอท
async function startBot() {
  console.clear();
  console.log(`${colors.bgMagenta}${colors.bright}                                                            ${colors.reset}`);
  console.log(`${colors.bgMagenta}${colors.bright}  🤖 Facebook Page Bot - Silent Mode (Professional Edition)  ${colors.reset}`);
  console.log(`${colors.bgMagenta}${colors.bright}                                                            ${colors.reset}`);
  console.log(`\n${colors.bright}${colors.cyan}╔${'═'.repeat(58)}╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}${colors.bright}  🚀 กำลังเริ่มต้นระบบบอท...${' '.repeat(28)}${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚${'═'.repeat(58)}╝${colors.reset}\n`);
  
  logger.info('กำลังตรวจสอบการตั้งค่า...');
  if (config.PAGE_ACCESS_TOKEN !== 'YOUR_PAGE_ACCESS_TOKEN_HERE') {
    logger.success('PAGE_ACCESS_TOKEN พบแล้ว');
  }
  if (config.VERIFY_TOKEN !== 'YOUR_VERIFY_TOKEN_HERE') {
    logger.success('VERIFY_TOKEN พบแล้ว');
  }
  
  ensureDirectories();
  loadCommands();
  
  app.listen(config.PORT, () => {
    console.log(`${colors.bright}${colors.green}╔${'═'.repeat(58)}╗${colors.reset}`);
    console.log(`${colors.bright}${colors.green}║${colors.reset}${colors.bright}  ✅ บอทออนไลน์และพร้อมใช้งานแล้ว!${' '.repeat(24)}${colors.green}║${colors.reset}`);
    console.log(`${colors.bright}${colors.green}╚${'═'.repeat(58)}╝${colors.reset}\n`);
    
    logger.info(`📡 กำลัง Listen บน Port: ${colors.bright}${config.PORT}${colors.reset}`);
    logger.info(`📋 คำสั่งที่โหลดไว้: ${colors.bright}${commands.size}${colors.reset} คำสั่ง`);
    logger.info(`🌐 Webhook URL: ${colors.bright}https://your-repl-url.replit.dev/webhook${colors.reset}`);
    logger.info(`⏰ เริ่มต้นเมื่อ: ${colors.bright}${stats.startTime.toLocaleString('th-TH')}${colors.reset}`);
    
    console.log(`\n${colors.bright}${colors.yellow}💡 คำแนะนำ:${colors.reset}`);
    console.log(`${colors.dim}   - พิมพ์ Ctrl+C เพื่อหยุดบอท${colors.reset}`);
    console.log(`${colors.dim}   - สถิติจะแสดงอัตโนมัติทุก 5 นาที${colors.reset}`);
    console.log(`${colors.dim}   - ตรวจสอบ Log เพื่อดูกิจกรรมแบบ Real-time${colors.reset}\n`);
    
    console.log(`${colors.bgGreen}${colors.bright} 🎉 ระบบพร้อมรับข้อความแล้ว! ${colors.reset}\n`);
    console.log(`${colors.dim}${'═'.repeat(60)}${colors.reset}\n`);
  });
}

// จัดการการปิดโปรแกรม
process.on('SIGINT', () => {
  console.log(`\n\n${colors.bgRed}${colors.bright} 🛑 กำลังหยุดบอท... ${colors.reset}\n`);
  showStats();
  logger.info('ขอบคุณที่ใช้งาน! 👋');
  process.exit(0);
});

startBot();
