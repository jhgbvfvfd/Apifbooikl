
// ================================
// 🚫 Auto Command: auto_email.js
// 📅 Last Updated: 2025-01-27
// 💡 สร้างอีเมลชั่วคราวอัตโนมัติ (แก้ไขให้รองรับผู้ใช้แต่ละคน - Per-User)
// ================================

const axios = require('axios');

// กำหนด URL ของ API
const API_URL = 'http://menu.panelaimbot.com:4002';

// เก็บข้อมูลการตรวจสอบอีเมลของแต่ละผู้ใช้
const emailCheckers = new Map();

module.exports = {
  name: 'auto_email',
  description: '📧 สร้างอีเมลชั่วคราวอัตโนมัติเมื่อมีคนขอ',
  auto: true,
  
  // ฟังก์ชันที่รันเมื่อมีข้อความใหม่
  async onMessage(senderId, messageText, api) {
    const emailKeywords = /(สร้างเมล|สร้างอีเมล|ขออีเมล|ขอเมล|เมลชั่วคราว|อีเมลชั่วคราว|temp email|temporary email)/i;
    
    if (!emailKeywords.test(messageText)) {
      return false; // ไม่ใช่คำสั่งของเรา ให้ประมวลผลต่อ
    }

    try {
      // ตรวจสอบว่าผู้ใช้นี้มีอีเมลอยู่แล้วหรือไม่
      if (emailCheckers.has(senderId)) {
        const checker = emailCheckers.get(senderId);
        await api.sendText(
          senderId,
          `⚠️ คุณมีอีเมลที่กำลังใช้งานอยู่แล้ว\n\n` +
          `📧 อีเมล: ${checker.email}\n` +
          `📨 ข้อความที่ได้รับ: ${checker.messageCount} รายการ\n\n` +
          `💡 รอให้หมดเวลา 30 นาทีก่อนสร้างใหม่`
        );
        return true;
      }

      // แสดง typing indicator
      await api.callSendAPI({
        recipient: { id: senderId },
        sender_action: 'typing_on'
      });

      // เรียก API สร้างอีเมล
      const response = await axios.get(`${API_URL}/get`, { timeout: 20000 });

      await api.callSendAPI({
        recipient: { id: senderId },
        sender_action: 'typing_off'
      });

      if (response.data.success && response.data.email) {
        const email = response.data.email;

        // ส่งข้อความแจ้งอีเมลที่สร้างสำเร็จ
        await api.sendText(
          senderId,
          `✅ สร้างอีเมลสำเร็จ!\n\n` +
          `📧 อีเมลของคุณ: ${email}\n` +
          `⏰ ระบบจะตรวจสอบข้อความใหม่อัตโนมัติ\n` +
          `⏱️ หมดเวลา: 30 นาที\n\n` +
          `💡 เมื่อมีอีเมลเข้า ระบบจะแจ้งเตือนให้ทันที`
        );

        // เริ่มตรวจสอบอีเมลอัตโนมัติสำหรับผู้ใช้นี้
        startEmailChecker(api, senderId, email);

      } else {
        await api.sendText(
          senderId,
          `❌ ไม่สามารถสร้างอีเมลได้\n\nโปรดลองใหม่อีกครั้ง`
        );
      }

    } catch (err) {
      console.error("Error in auto_email:", err.message);
      await api.sendText(
        senderId,
        `❌ เกิดข้อผิดพลาด: ${err.message}\n\nโปรดตรวจสอบว่าระบบ API ทำงานอยู่`
      );
    }

    return true; // จัดการข้อความแล้ว
  },

  async execute(senderId, args, api) {
    await api.sendText(
      senderId,
      '📧 วิธีใช้งาน Auto Email\n\n' +
      '💡 พิมพ์คำเหล่านี้เพื่อสร้างอีเมลชั่วคราว:\n' +
      '• สร้างเมล\n' +
      '• สร้างอีเมล\n' +
      '• ขออีเมล\n' +
      '• เมลชั่วคราว\n\n' +
      'ระบบจะสร้างอีเมลชั่วคราวให้คุณและตรวจสอบข้อความใหม่อัตโนมัติ'
    );
  }
};

// ฟังก์ชันตรวจสอบอีเมลอัตโนมัติ
function startEmailChecker(api, senderId, email) {
  let messageCount = 0;
  let lastMessageIds = new Set();

  // ตรวจสอบทุก 5 วินาที
  const interval = setInterval(async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/${email}`, { timeout: 10000 });

      if (response.data.success && response.data.messages) {
        const messages = response.data.messages;
        const newMessages = messages.filter(msg => !lastMessageIds.has(msg.id));

        if (newMessages.length > 0) {
          messageCount = messages.length;

          for (const msg of newMessages) {
            lastMessageIds.add(msg.id);

            let notification = `📨 คุณมีอีเมลใหม่!\n` +
              `${'─'.repeat(35)}\n\n` +
              `📧 ส่งถึง: ${msg.to || email}\n` +
              `👤 จาก: ${msg.from}\n` +
              `📝 หัวข้อ: ${msg.subject}\n` +
              `🕐 เวลา: ${new Date(msg.timestamp).toLocaleString('th-TH')}\n`;

            if (msg.body) {
              const bodyPreview = msg.body.length > 500 
                ? msg.body.substring(0, 500) + '...' 
                : msg.body;
              notification += `\n📄 เนื้อหา:\n${bodyPreview}\n`;
            }

            if (msg.links && msg.links.length > 0) {
              notification += `\n🔗 ลิงก์ในอีเมล:\n`;
              msg.links.slice(0, 5).forEach((link, i) => {
                notification += `${i + 1}. ${link}\n`;
              });
              if (msg.links.length > 5) {
                notification += `... และอีก ${msg.links.length - 5} ลิงก์\n`;
              }
            }

            notification += `\n${'─'.repeat(35)}`;
            await api.sendText(senderId, notification);
          }

          // อัพเดทข้อมูลของ checker สำหรับผู้ใช้นี้
          if (emailCheckers.has(senderId)) {
            const checker = emailCheckers.get(senderId);
            checker.messageCount = messageCount;
          }
        }
      }
    } catch (err) {
      // ไม่แจ้งเตือนทุกครั้งที่เช็คไม่สำเร็จ
      console.error(`Error checking email for sender ${senderId}:`, err.message);
    }
  }, 5000); // ตรวจสอบทุก 5 วินาที

  // เก็บข้อมูล checker โดยใช้ senderId เป็น key
  emailCheckers.set(senderId, {
    email: email,
    interval: interval,
    messageCount: messageCount,
    lastMessageIds: lastMessageIds
  });

  // หยุดอัตโนมัติหลัง 30 นาที
  setTimeout(async () => {
    const finalCheckerState = emailCheckers.get(senderId);
    const finalMessageCount = finalCheckerState ? finalCheckerState.messageCount : messageCount;
    
    stopEmailChecker(senderId);
    
    await api.sendText(
      senderId,
      `⏰ หมดเวลาสำหรับอีเมลของคุณ\n\n` +
      `📧 อีเมล: ${email}\n` +
      `📨 ได้รับข้อความทั้งหมด: ${finalMessageCount} รายการ\n\n` +
      `💡 หากต้องการใช้อีกครั้ง พิมพ์ "สร้างอีเมล" เพื่อสร้างใหม่`
    );
  }, 30 * 60 * 1000); // 30 นาที
}

// ฟังก์ชันหยุดตรวจสอบอีเมล
function stopEmailChecker(senderId) {
  if (emailCheckers.has(senderId)) {
    const checker = emailCheckers.get(senderId);
    clearInterval(checker.interval);
    emailCheckers.delete(senderId);
    console.log(`Stopped email checker for sender: ${senderId}`);
  }
}
