const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ไฟล์สำหรับเก็บข้อมูลผู้ใช้
const DATA_FILE = path.join(__dirname, '..', 'auto', 'registered_users.json');
const PENDING_FILE = path.join(__dirname, '..', 'auto', 'pending_users.json');

// ไอดีของแอดมิน (เปลี่ยนเป็นไอดีของคุณ)
const ADMIN_IDS = ['61555184860915', '32793531976900783'];

// ฟังก์ชันโหลดข้อมูลผู้ใช้จากไฟล์
function loadRegisteredUsers() {
  try {
    // สร้างโฟลเดอร์ auto ถ้ายังไม่มี
    const autoDir = path.join(__dirname, '..', 'auto');
    if (!fs.existsSync(autoDir)) {
      fs.mkdirSync(autoDir, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const users = JSON.parse(data);
      return new Set(users);
    }
  } catch (error) {
    console.error('Error loading registered users:', error.message);
  }
  return new Set();
}

// ฟังก์ชันโหลดผู้ใช้ที่รออนุมัติ
function loadPendingUsers() {
  try {
    const autoDir = path.join(__dirname, '..', 'auto');
    if (!fs.existsSync(autoDir)) {
      fs.mkdirSync(autoDir, { recursive: true });
    }

    if (fs.existsSync(PENDING_FILE)) {
      const data = fs.readFileSync(PENDING_FILE, 'utf8');
      return new Map(JSON.parse(data));
    }
  } catch (error) {
    console.error('Error loading pending users:', error.message);
  }
  return new Map();
}

// ฟังก์ชันบันทึกข้อมูลผู้ใช้ลงไฟล์
function saveRegisteredUsers(usersSet) {
  try {
    const usersArray = Array.from(usersSet);
    fs.writeFileSync(DATA_FILE, JSON.stringify(usersArray, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving registered users:', error.message);
  }
}

// ฟังก์ชันบันทึกผู้ใช้ที่รออนุมัติ
function savePendingUsers(pendingMap) {
  try {
    const pendingArray = Array.from(pendingMap.entries());
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingArray, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving pending users:', error.message);
  }
}

module.exports = {
  name: 'aigpt',
  description: '🤖 AI Assistant - พิมพ์ "เปิด" เพื่อเริ่มสนทนา, "ปิด" เพื่อหยุด',
  auto: true,

  // เก็บสถานะผู้ใช้ที่เปิดใช้งาน AI (ชั่วคราว)
  activeUsers: new Set(),

  // เก็บผู้ใช้ที่ลงทะเบียนแล้ว (โหลดจากไฟล์)
  registeredUsers: loadRegisteredUsers(),

  // เก็บผู้ใช้ที่รออนุมัติ (โหลดจากไฟล์)
  pendingUsers: loadPendingUsers(),

  // ฟังก์ชันสำหรับเรียก GPT-4o API
  async callGPT4o(prompt) {
    try {
      const response = await axios.get(`https://api-library-kohi.onrender.com/api/gpt4o`, {
        params: { prompt: prompt }
      });

      if (response.data && response.data.status && response.data.data) {
        return response.data.data;
      }
      return 'ขออภัยครับ ไม่สามารถรับคำตอบจาก AI ได้';
    } catch (error) {
      console.error('GPT-4o API Error:', error.message);
      return 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI';
    }
  },

  // ฟังก์ชันที่รันเมื่อมีข้อความใหม่
  async onMessage(senderId, messageText, api) {
    const text = messageText.trim().toLowerCase();

    // === ส่วนของแอดมิน ===
    if (ADMIN_IDS.includes(senderId)) {
      // ตรวจสอบคำสั่งอนุมัติ/ไม่อนุมัติ
      const approveMatch = text.match(/^อนุมัติ\s+(\d+)$/);
      const rejectMatch = text.match(/^ไม่อนุมัติ\s+(\d+)$/);

      if (approveMatch) {
        const userId = approveMatch[1];
        if (this.pendingUsers.has(userId)) {
          // อนุมัติผู้ใช้
          this.registeredUsers.add(userId);
          saveRegisteredUsers(this.registeredUsers);

          this.pendingUsers.delete(userId);
          savePendingUsers(this.pendingUsers);

          // แจ้งแอดมิน
          for (const adminId of ADMIN_IDS) {
            await api.sendText(adminId, `✅ อนุมัติผู้ใช้ ${userId} เรียบร้อยแล้ว`);
          }

          // แจ้งผู้ใช้
          await api.sendText(userId,
            '✅ คำขอลงทะเบียนของคุณได้รับการอนุมัติแล้ว!\n\n' +
            '📌 วิธีใช้งาน:\n' +
            '• พิมพ์ "เปิด" - เริ่มสนทนากับ AI\n' +
            '• พิมพ์ "ปิด" - หยุดสนทนากับ AI\n\n' +
            'คุณสามารถเริ่มใช้งานได้เลย!'
          );
          return true;
        } else {
          await api.sendText(senderId, `❌ ไม่พบผู้ใช้ ${userId} ในรายการรออนุมัติ`);
          return true;
        }
      }

      if (rejectMatch) {
        const userId = rejectMatch[1];
        if (this.pendingUsers.has(userId)) {
          // ปฏิเสธผู้ใช้
          this.pendingUsers.delete(userId);
          savePendingUsers(this.pendingUsers);

          // แจ้งแอดมิน
          for (const adminId of ADMIN_IDS) {
            await api.sendText(adminId, `❌ ปฏิเสธผู้ใช้ ${userId} เรียบร้อยแล้ว`);
          }

          // แจ้งผู้ใช้
          await api.sendText(userId,
            '❌ ขออภัย คำขอลงทะเบียนของคุณไม่ได้รับการอนุมัติ\n\n' +
            'หากคุณคิดว่านี่เป็นความผิดพลาด กรุณาติดต่อแอดมิน'
          );
          return true;
        } else {
          await api.sendText(senderId, `❌ ไม่พบผู้ใช้ ${userId} ในรายการรออนุมัติ`);
          return true;
        }
      }

      // คำสั่งดูรายการรออนุมัติ
      if (text === 'รออนุมัติ' || text === 'pending') {
        if (this.pendingUsers.size === 0) {
          await api.sendText(senderId, '📋 ไม่มีผู้ใช้รออนุมัติ');
        } else {
          let message = '📋 รายการผู้ใช้รออนุมัติ:\n' + '─'.repeat(35) + '\n\n';
          let count = 1;
          for (const [userId, timestamp] of this.pendingUsers) {
            message += `${count}. ไอดี: ${userId}\n`;
            message += `   เวลา: ${new Date(timestamp).toLocaleString('th-TH')}\n\n`;
            count++;
          }
          message += '─'.repeat(35) + '\n';
          message += '💡 ใช้คำสั่ง:\n';
          message += '• "อนุมัติ [ไอดี]" - เพื่ออนุมัติ\n';
          message += '• "ไม่อนุมัติ [ไอดี]" - เพื่อปฏิเสธ';

          await api.sendText(senderId, message);
        }
        return true;
      }
    }

    // === ส่วนของผู้ใช้ทั่วไป ===

    // ตรวจสอบว่าผู้ใช้ลงทะเบียนแล้วหรือยัง
    if (!this.registeredUsers.has(senderId)) {
      // ตรวจสอบว่ากำลังรออนุมัติอยู่หรือไม่
      if (this.pendingUsers.has(senderId)) {
        await api.sendText(senderId,
          '⏳ คำขอลงทะเบียนของคุณกำลังรอการอนุมัติจากแอดมิน\n\n' +
          'กรุณารอสักครู่ ระบบจะแจ้งเตือนเมื่อได้รับการอนุมัติ'
        );
        return true;
      }

      // ถ้ายังไม่ได้ลงทะเบียน ให้ลงทะเบียนก่อน
      if (text === 'ลงทะเบียน') {
        // บันทึกลงรายการรออนุมัติ
        this.pendingUsers.set(senderId, Date.now());
        savePendingUsers(this.pendingUsers);

        // แจ้งผู้ใช้
        await api.sendText(senderId,
          '📝 ส่งคำขอลงทะเบียนแล้ว!\n\n' +
          '🆔 ไอดีของคุณ: ' + senderId + '\n\n' +
          '⏳ กรุณารอการอนุมัติจากแอดมิน\n' +
          'ระบบจะแจ้งเตือนเมื่อได้รับการอนุมัติ'
        );

        // แจ้งแอดมิน
        for (const adminId of ADMIN_IDS) {
          await api.sendText(adminId,
            '🔔 มีคำขอลงทะเบียนใหม่!\n\n' +
            '🆔 ไอดีผู้ใช้: ' + senderId + '\n' +
            '🕐 เวลา: ' + new Date().toLocaleString('th-TH') + '\n\n' +
            '💡 ใช้คำสั่ง:\n' +
            '• "อนุมัติ ' + senderId + '" - เพื่ออนุมัติ\n' +
            '• "ไม่อนุมัติ ' + senderId + '" - เพื่อปฏิเสธ\n' +
            '• "รออนุมัติ" - ดูรายการทั้งหมด'
          );
        }

        return true;
      } else {
        // ส่งข้อความให้ลงทะเบียนก่อน
        await api.sendText(senderId,
          '⚠️ คุณยังไม่ได้ลงทะเบียน\n\n' +
          'กรุณาพิมพ์ "ลงทะเบียน" เพื่อเริ่มใช้งานบอท'
        );
        return true;
      }
    }

    // ตรวจสอบคำสั่งเปิด/ปิด (สำหรับผู้ใช้ที่ลงทะเบียนแล้ว)
    if (text === 'เปิด') {
      this.activeUsers.add(senderId);
      await api.sendText(senderId, '✅ เปิดโหมด AI Assistant แล้ว\n\nคุณสามารถคุยกับ AI ได้เลย พิมพ์ "ปิด" เพื่อหยุดการสนทนา');
      return true;
    }

    if (text === 'ปิด') {
      this.activeUsers.delete(senderId);
      await api.sendText(senderId, '❌ ปิดโหมด AI Assistant แล้ว\n\nคุณสามารถใช้คำสั่งปกติได้ตามปกติ พิมพ์ "เปิด" เมื่อต้องการคุยกับ AI อีกครั้ง');
      return true;
    }

    // ถ้าผู้ใช้เปิดโหมด AI ให้ส่งข้อความไปยัง GPT-4o
    if (this.activeUsers.has(senderId)) {
      // แสดง typing indicator
      await api.callSendAPI({
        recipient: { id: senderId },
        sender_action: 'typing_on'
      });

      const aiResponse = await this.callGPT4o(messageText);

      await api.callSendAPI({
        recipient: { id: senderId },
        sender_action: 'typing_off'
      });

      await api.sendText(senderId, `🤖 AI: ${aiResponse}`);
      return true;
    }

    return false;
  },

  // ฟังก์ชันสำหรับเรียกใช้คำสั่งปกติ
  async execute(senderId, args, api) {
    if (!this.registeredUsers.has(senderId)) {
      await api.sendText(senderId,
        '⚠️ คุณยังไม่ได้ลงทะเบียน\n\n' +
        'กรุณาพิมพ์ "ลงทะเบียน" เพื่อเริ่มใช้งานบอท'
      );
      return;
    }

    if (this.activeUsers.has(senderId)) {
      await api.sendText(senderId, '💡 คุณอยู่ในโหมด AI แล้ว\n\nพิมพ์อะไรก็ได้เพื่อคุยกับ AI หรือพิมพ์ "ปิด" เพื่อออกจากโหมด AI');
    } else {
      await api.sendText(senderId, '🤖 AI Assistant\n\n📌 วิธีใช้งาน:\n• พิมพ์ "เปิด" - เริ่มสนทนากับ AI\n• พิมพ์ "ปิด" - หยุดสนทนากับ AI\n\nเมื่อเปิดโหมด AI แล้ว คุณสามารถคุยอะไรก็ได้กับ AI');
    }
  }
};