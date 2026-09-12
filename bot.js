// ============================================================
// HDM TELEGRAM BOT - Cấp key tự động
// Author: HDM
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// ===== CẤU HÌNH =====
const BOT_TOKEN = '8344997575:AAFVHwMloiWpTyQ3s27c1cwmlqM6WobkuEQ';
const ADMIN_ID = 6780308119;
const KEY_PRICE = 5000;
const BANK_INFO = {
    bank: 'VPBank',
    account: '6566221227',
    owner: 'DO HAI DANG'
};
const TELEGRAM_SUPPORT = '@spmxhhdm';

// ===== CÔNG THỨC TẠO KEY (PHẢI GIỐNG TOOL) =====
const SECRET_A = 7919;
const SECRET_B = 2026;
const SECRET_C = 104729;

function generateKey() {
    const xxxx = String(Math.floor(Math.random() * 90000) + 10000);
    const yyyy = String((parseInt(xxxx) * SECRET_A + SECRET_B) % SECRET_C).padStart(5, '0').slice(-5);
    return `HDM-${xxxx}-${yyyy}`;
}

// ===== DATABASE =====
const DB_FILE = path.join(__dirname, 'bot_keys.json');

function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({ pending: {}, keys: [] }, null, 2));
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('DB load error:', e);
        return { pending: {}, keys: [] };
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB save error:', e);
    }
}

// ===== BOT =====
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 HDM Bot đang khởi động...');

// ===== LỆNH /start =====
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'bạn';
    
    bot.sendMessage(chatId, 
        `👋 Xin chào *${name}*!\n\n` +
        `🔑 *HDM KEY BOT*\n\n` +
        `💰 Giá: *5.000đ/key*\n` +
        `💳 Ngân hàng: *${BANK_INFO.bank}*\n` +
        `🔢 STK: \`${BANK_INFO.account}\`\n` +
        `👤 Chủ TK: *${BANK_INFO.owner}*\n\n` +
        `📌 *Hướng dẫn:*\n` +
        `1️⃣ Chuyển 5.000đ vào STK trên\n` +
        `2️⃣ Chụp bill → gửi vào đây\n` +
        `3️⃣ Chờ admin duyệt → nhận key\n\n` +
        `⏰ Key sẽ tự động thu hồi sau 1 phút\n` +
        `📱 Hỗ trợ: ${TELEGRAM_SUPPORT}`,
        { parse_mode: 'Markdown' }
    );
});

// ===== LỆNH /help =====
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `📖 *HƯỚNG DẪN SỬ DỤNG*\n\n` +
        `1. Chuyển khoản 5.000đ vào:\n` +
        `   • Ngân hàng: ${BANK_INFO.bank}\n` +
        `   • STK: \`${BANK_INFO.account}\`\n` +
        `   • Chủ TK: ${BANK_INFO.owner}\n\n` +
        `2. Chụp ảnh bill chuyển khoản\n` +
        `3. Gửi ảnh vào bot này\n` +
        `4. Chờ admin duyệt (1-5 phút)\n` +
        `5. Nhận key → nhập vào tool\n\n` +
        `⚠️ *Lưu ý:*\n` +
        `• Key chỉ dùng được 1 lần\n` +
        `• Key bị thu hồi sau 1 phút\n` +
        `• Copy key ngay khi nhận\n\n` +
        `📱 Hỗ trợ: ${TELEGRAM_SUPPORT}`,
        { parse_mode: 'Markdown' }
    );
});

// ===== NHẬN BILL TỪ USER =====
bot.on('photo', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const username = msg.from.username || msg.from.first_name || 'Unknown';
        
        // Admin gửi ảnh thì bỏ qua
        if (chatId === ADMIN_ID) return;
        
        // Lưu pending
        const db = loadDB();
        const pendingId = `pending_${Date.now()}_${chatId}`;
        db.pending[pendingId] = {
            chatId: chatId,
            username: username,
            photoId: msg.photo[msg.photo.length - 1].file_id,
            time: new Date().toISOString()
        };
        saveDB(db);
        
        // Forward cho admin
        bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, {
            caption: `🔔 *BILL MỚI*\n\n` +
                     `👤 User: @${username}\n` +
                     `🆔 Chat ID: \`${chatId}\`\n` +
                     `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
                     `Bấm nút bên dưới để cấp key:`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ CẤP KEY', callback_data: `approve_${pendingId}` },
                    { text: '❌ TỪ CHỐI', callback_data: `reject_${pendingId}` }
                ]]
            }
        });
        
        bot.sendMessage(chatId, 
            `✅ *Đã nhận bill!*\n\n` +
            `⏳ Chờ admin duyệt... (1-5 phút)\n` +
            `📱 Hỗ trợ: ${TELEGRAM_SUPPORT}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Photo handler error:', e);
    }
});

// ===== ADMIN DUYỆT =====
bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;
        const data = query.data;
        
        if (chatId !== ADMIN_ID) {
            bot.answerCallbackQuery(query.id, { text: '❌ Bạn không có quyền!' });
            return;
        }
        
        const db = loadDB();
        
        // ===== CẤP KEY =====
        if (data.startsWith('approve_')) {
            const pendingId = data.replace('approve_', '');
            const pending = db.pending[pendingId];
            
            if (!pending) {
                bot.answerCallbackQuery(query.id, { text: '❌ Không tìm thấy!' });
                return;
            }
            
            // Tạo key
            const newKey = generateKey();
            db.keys.push({
                key: newKey,
                chatId: pending.chatId,
                username: pending.username,
                created: new Date().toISOString(),
                used: false
            });
            delete db.pending[pendingId];
            saveDB(db);
            
            // Gửi key cho user
            bot.sendMessage(pending.chatId, 
                `🔑 *KEY CỦA BẠN*\n\n` +
                `\`${newKey}\`\n\n` +
                `⏰ Tin nhắn này sẽ tự xóa sau 1 phút\n` +
                `📌 Nhập key vào tool để sử dụng\n\n` +
                `⚠️ Copy key ngay!`,
                { parse_mode: 'Markdown' }
            ).then((sentMsg) => {
                // Thu hồi sau 1 phút
                setTimeout(() => {
                    bot.deleteMessage(pending.chatId, sentMsg.message_id)
                        .catch(() => console.log('Không thể thu hồi tin nhắn'));
                }, 60000);
            });
            
            // Báo admin
            bot.editMessageCaption(
                `✅ *ĐÃ CẤP KEY*\n\n` +
                `👤 User: @${pending.username}\n` +
                `🆔 Chat ID: \`${pending.chatId}\`\n` +
                `🔑 Key: \`${newKey}\`\n` +
                `⏰ ${new Date().toLocaleString('vi-VN')}`,
                {
                    chat_id: ADMIN_ID,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            
            bot.answerCallbackQuery(query.id, { text: '✅ Đã cấp key!' });
        }
        
        // ===== TỪ CHỐI =====
        else if (data.startsWith('reject_')) {
            const pendingId = data.replace('reject_', '');
            const pending = db.pending[pendingId];
            
            if (!pending) {
                bot.answerCallbackQuery(query.id, { text: '❌ Không tìm thấy!' });
                return;
            }
            
            bot.sendMessage(pending.chatId, 
                `❌ *Bill không hợp lệ*\n\n` +
                `Vui lòng liên hệ ${TELEGRAM_SUPPORT} để được hỗ trợ.`,
                { parse_mode: 'Markdown' }
            );
            
            delete db.pending[pendingId];
            saveDB(db);
            
            bot.editMessageCaption(
                `❌ *ĐÃ TỪ CHỐI*\n\n` +
                `👤 User: @${pending.username}\n` +
                `🆔 Chat ID: \`${pending.chatId}\``,
                {
                    chat_id: ADMIN_ID,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                }
            );
            
            bot.answerCallbackQuery(query.id, { text: '❌ Đã từ chối!' });
        }
    } catch (e) {
        console.error('Callback error:', e);
    }
});

// ===== LỆNH ADMIN =====
bot.onText(/\/listkeys/, (msg) => {
    if (msg.chat.id !== ADMIN_ID) return;
    
    const db = loadDB();
    const keys = db.keys.slice(-20);
    
    if (keys.length === 0) {
        bot.sendMessage(ADMIN_ID, '📭 Chưa có key nào.');
        return;
    }
    
    let text = `📋 *20 KEY GẦN NHẤT*\n\n`;
    keys.forEach((k, i) => {
        text += `${i+1}. \`${k.key}\` - ${k.used ? '🔴 Đã dùng' : '🟢 Chưa dùng'}\n`;
    });
    
    bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/stats/, (msg) => {
    if (msg.chat.id !== ADMIN_ID) return;
    
    const db = loadDB();
    const total = db.keys.length;
    const used = db.keys.filter(k => k.used).length;
    const pending = Object.keys(db.pending).length;
    
    bot.sendMessage(ADMIN_ID,
        `📊 *THỐNG KÊ*\n\n` +
        `🔑 Tổng key: *${total}*\n` +
        `🟢 Chưa dùng: *${total - used}*\n` +
        `🔴 Đã dùng: *${used}*\n` +
        `⏳ Chờ duyệt: *${pending}*\n\n` +
        `💰 Doanh thu ước tính: *${(used * KEY_PRICE).toLocaleString('vi-VN')}đ*`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/pending/, (msg) => {
    if (msg.chat.id !== ADMIN_ID) return;
    
    const db = loadDB();
    const pendingList = Object.entries(db.pending);
    
    if (pendingList.length === 0) {
        bot.sendMessage(ADMIN_ID, '📭 Không có bill nào chờ duyệt.');
        return;
    }
    
    let text = `⏳ *BILL CHỜ DUYỆT* (${pendingList.length})\n\n`;
    pendingList.forEach(([id, p], i) => {
        text += `${i+1}. @${p.username} - ${new Date(p.time).toLocaleString('vi-VN')}\n`;
    });
    
    bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' });
});

// ===== XỬ LÝ LỖI =====
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});

console.log('✅ HDM Bot đã sẵn sàng!');
console.log(`👤 Admin ID: ${ADMIN_ID}`);
console.log(`💰 Giá key: ${KEY_PRICE.toLocaleString('vi-VN')}đ`);